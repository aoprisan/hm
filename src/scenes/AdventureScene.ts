// Adventure map scene (mobile-first): the map fills the screen and the camera
// pans (drag) over it. A tap previews a route; a confirming tap (or the "March"
// button) sends the hero. Translucent overlays carry the resources, the action
// bar, and a pull-up Army/minimap sheet so the map stays uncluttered.
import type { App } from "../app";
import { Scene } from "../engine/scene";
import { Renderer } from "../engine/renderer";
import { Input } from "../engine/input";
import { Sfx } from "../engine/audio";
import { findPath, PathTile } from "../game/pathfind";
import { MapObject } from "../game/map";
import { Stack, armyIsEmpty, armyPower } from "../game/army";
import { addBag } from "../data/resources";
import { CREATURES } from "../data/creatures";
import { endTurn } from "../game/economy";
import { TILE, terrainTileFor } from "../art/sprites_terrain";
import {
  heroSprite, castleSprite, strongholdSprite, mineSprite, flagSprite,
  resourcePile, chestSprite, signSprite, bigTree, bigRock,
} from "../art/sprites_objects";
import { creatureSprite } from "../art/sprites_creatures";
import { drawResourceBar, HUD_H } from "../ui/hud";
import { heroBadge } from "../ui/herobadge";
import {
  Button, button, glass, panel, parchment, pointInRect, roundRectPath,
  text, textShadow, wrapText, Rect,
} from "../ui/widgets";

const TERRAIN_COLOR: Record<string, string> = {
  grass: "#4f8a3a", dirt: "#b3863f", sand: "#d8b06a", forest: "#2f5a22",
  water: "#2f6fb0", mountain: "#7d756a", rock: "#5f574c",
};

interface Modal { title: string; body: string; onClose?: () => void; }

interface Layout {
  vw: number; vh: number; portrait: boolean;
  topH: number; barH: number; zoom: number;
  btnArmy: Button; btnEnd: Button; btnCastle: Button;
  march: Rect; cancel: Rect; // pending-move confirm pills
  sheetY: number;            // top of the army/minimap sheet
}

export class AdventureScene implements Scene {
  private camX = 0; // world px (tile = TILE)
  private camY = 0;
  private hoverTile = { x: -1, y: -1 };
  private previewPath: PathTile[] | null = null;
  private pending: { x: number; y: number } | null = null;
  private waterAnim = 0;
  private waterFrame = 0;
  private moving = false;
  private stepFrom = { x: 0, y: 0 };
  private stepTo = { x: 0, y: 0 };
  private stepT = 0;
  private stepCost = 0;
  private modal: Modal | null = null;
  private sheetOpen = false;

  constructor(private app: App) {}

  enter(): void { this.centerOnHero(true); }

  private get state() { return this.app.state; }
  private get r(): Renderer { return this.app.renderer; }

  // ---------------- responsive layout ----------------
  private layout(): Layout {
    const r = this.r;
    const vw = r.vw, vh = r.vh, portrait = r.portrait;
    const topH = HUD_H;
    const barH = Math.round(Math.min(76, Math.max(58, vh * 0.1)));
    const tilePx = Math.max(40, Math.min(60, Math.round(Math.min(vw, vh) / 9)));
    const zoom = tilePx / TILE;

    const side = 12, gap = 10;
    const bw = vw - side * 2;
    const unit = (bw - gap * 2) / 3.5;
    const by = vh - barH + 8, bh = barH - 16;
    const armyW = Math.round(unit), endW = Math.round(unit * 1.5);
    const castleW = bw - armyW - endW - gap * 2;
    const btnArmy: Button = { x: side, y: by, w: armyW, h: bh, label: "Army" };
    const btnEnd: Button = { x: side + armyW + gap, y: by, w: endW, h: bh, label: "End Turn", primary: true };
    const btnCastle: Button = { x: side + armyW + endW + gap * 2, y: by, w: castleW, h: bh, label: "Castle" };

    const fabH = 46;
    const fabW = Math.min(220, vw - 120);
    const groupW = fabW + 8 + fabH;
    const gx = (vw - groupW) / 2;
    const fy = vh - barH - fabH - 12;
    const march: Rect = { x: gx, y: fy, w: fabW, h: fabH };
    const cancel: Rect = { x: gx + fabW + 8, y: fy, w: fabH, h: fabH };

    const sheetY = Math.round(portrait ? vh * 0.40 : vh * 0.28);
    return { vw, vh, portrait, topH, barH, zoom, btnArmy, btnEnd, btnCastle, march, cancel, sheetY };
  }

  private visibleWorld(L: Layout): { w: number; h: number } {
    return { w: L.vw / L.zoom, h: L.vh / L.zoom };
  }

  private centerOnHero(snap = false): void {
    const L = this.layout();
    const vis = this.visibleWorld(L);
    const h = this.state.hero;
    // center within the band between the top bar and the bottom action bar
    const bandCenterY = (L.topH + (L.vh - L.barH)) / 2 / L.zoom;
    const tx = h.fx * TILE + TILE / 2 - vis.w / 2;
    const ty = h.fy * TILE + TILE / 2 - bandCenterY;
    const maxX = Math.max(0, this.state.map.width * TILE - vis.w);
    const maxY = Math.max(0, this.state.map.height * TILE - vis.h);
    const cx = Math.max(0, Math.min(maxX, tx));
    const cy = Math.max(0, Math.min(maxY, ty));
    if (snap) { this.camX = cx; this.camY = cy; }
    else { this.camX += (cx - this.camX) * 0.18; this.camY += (cy - this.camY) * 0.18; }
  }

  private clampCam(L: Layout): void {
    const vis = this.visibleWorld(L);
    const maxX = Math.max(0, this.state.map.width * TILE - vis.w);
    const maxY = Math.max(0, this.state.map.height * TILE - vis.h);
    this.camX = Math.max(0, Math.min(maxX, this.camX));
    this.camY = Math.max(0, Math.min(maxY, this.camY));
  }

  private screenToTile(L: Layout, px: number, py: number): { x: number; y: number } {
    return {
      x: Math.floor((px / L.zoom + this.camX) / TILE),
      y: Math.floor((py / L.zoom + this.camY) / TILE),
    };
  }

  // ---------------- update ----------------
  update(dt: number, input: Input): void {
    const L = this.layout();
    this.waterAnim += dt;
    if (this.waterAnim > 0.35) { this.waterAnim = 0; this.waterFrame++; }

    const pan = input.takePan();
    if (this.moving) {
      this.centerOnHero(false);
    } else if (this.state.phase === "playing" && !this.sheetOpen && (pan.dx || pan.dy)) {
      this.camX -= pan.dx / L.zoom;
      this.camY -= pan.dy / L.zoom;
      this.clampCam(L);
    }

    // desktop hover preview (touch uses tap-to-preview instead)
    const p = input.pointer;
    if (!this.moving && this.state.phase === "playing" && !this.sheetOpen && !this.modal
        && p.y > L.topH && p.y < L.vh - L.barH) {
      const t = this.screenToTile(L, p.x, p.y);
      if (t.x !== this.hoverTile.x || t.y !== this.hoverTile.y) {
        this.hoverTile = t;
        if (!this.pending) this.recomputePreview(t);
      }
    }

    if (this.moving) this.advanceStep(dt);

    for (const c of input.takeClicks()) this.handleClick(L, c.x, c.y, c.button);
    for (const k of input.takeKeys()) {
      if (k === "Enter" || k === " ") { if (!this.modal && !this.sheetOpen && this.state.phase === "playing") this.doEndTurn(); }
      if (k === "Escape") { if (this.modal) this.modal = null; else if (this.sheetOpen) this.sheetOpen = false; else this.clearPending(); }
    }
  }

  private recomputePreview(t: { x: number; y: number }): void {
    const h = this.state.hero;
    if (!this.state.map.inBounds(t.x, t.y) || !this.state.fog.isRevealed(t.x, t.y)) {
      this.previewPath = null;
      return;
    }
    this.previewPath = findPath(this.state.map, h.x, h.y, t.x, t.y);
  }

  private clearPending(): void {
    this.pending = null;
    this.previewPath = null;
  }

  private handleClick(L: Layout, px: number, py: number, btn: number): void {
    Sfx.click();
    if (this.modal) { const m = this.modal; this.modal = null; m.onClose?.(); return; }

    if (this.state.phase !== "playing") {
      const b = this.endScreenButton(L);
      if (pointInRect(px, py, b)) this.app.toMenu();
      return;
    }

    // right-click / secondary cancels a pending march
    if (btn === 2) { this.clearPending(); return; }

    // army / minimap sheet
    if (this.sheetOpen) {
      if (py < L.sheetY) this.sheetOpen = false; // tapped the dimmed map above
      // taps inside the sheet are consumed (close button handled here)
      const close = this.sheetCloseRect(L);
      if (pointInRect(px, py, close)) this.sheetOpen = false;
      return;
    }

    // pending-march confirm pills
    if (this.pending) {
      if (pointInRect(px, py, L.march)) { this.confirmMarch(); return; }
      if (pointInRect(px, py, L.cancel)) { this.clearPending(); return; }
    }

    // bottom action bar
    if (pointInRect(px, py, L.btnArmy)) { this.sheetOpen = true; return; }
    if (pointInRect(px, py, L.btnEnd)) { this.doEndTurn(); return; }
    if (pointInRect(px, py, L.btnCastle)) {
      // It's your own town — you can manage its garrison anytime, hero or not.
      this.app.openTown();
      return;
    }

    // top resource bar swallows taps so the hero doesn't march underneath it
    if (py < L.topH) return;
    if (py > L.vh - L.barH) return;

    // map tap: preview, then confirm
    if (this.moving) return;
    const t = this.screenToTile(L, px, py);
    if (!this.state.map.inBounds(t.x, t.y) || !this.state.fog.isRevealed(t.x, t.y)) { this.clearPending(); return; }
    if (this.pending && this.pending.x === t.x && this.pending.y === t.y) { this.confirmMarch(); return; }
    const path = findPath(this.state.map, this.state.hero.x, this.state.hero.y, t.x, t.y);
    if (path && path.length) { this.pending = { x: t.x, y: t.y }; this.previewPath = path; }
    else this.clearPending();
  }

  private confirmMarch(): void {
    if (!this.previewPath || !this.previewPath.length) { this.clearPending(); return; }
    this.state.hero.path = this.previewPath;
    this.pending = null;
    this.startNextStep();
  }

  private doEndTurn(): void {
    endTurn(this.state);
    this.state.hero.path = [];
    this.moving = false;
    this.clearPending();
    this.centerOnHero(true);
  }

  private flash(msg: string): void { this.modal = { title: "", body: msg }; }

  // ----- movement stepping -----
  private startNextStep(): void {
    const h = this.state.hero;
    if (!h.path.length) { this.moving = false; return; }
    const next = h.path[0];
    if (h.movePoints < next.cost && next.cost > 0) { h.path = []; this.moving = false; this.flash("Not enough movement left this turn."); return; }
    this.stepFrom = { x: h.fx, y: h.fy };
    this.stepTo = { x: next.x, y: next.y };
    this.stepCost = next.cost;
    this.stepT = 0;
    this.moving = true;
    if (next.x > h.x) h.facing = 1;
    else if (next.x < h.x) h.facing = -1;
  }

  private advanceStep(dt: number): void {
    const h = this.state.hero;
    this.stepT += dt * 4.5;
    if (this.stepT >= 1) {
      this.stepT = 1;
      h.fx = this.stepTo.x; h.fy = this.stepTo.y;
      const fromX = h.x, fromY = h.y;
      h.x = this.stepTo.x; h.y = this.stepTo.y;
      h.movePoints = Math.max(0, h.movePoints - this.stepCost);
      h.path.shift();
      this.state.fog.reveal(h.x, h.y, h.scouting);
      this.moving = false;
      const stop = this.arriveAt(h.x, h.y, fromX, fromY);
      if (!stop && h.path.length && h.movePoints > 0) this.startNextStep();
      else { h.path = []; this.previewPath = null; }
    } else {
      h.fx = this.stepFrom.x + (this.stepTo.x - this.stepFrom.x) * this.stepT;
      h.fy = this.stepFrom.y + (this.stepTo.y - this.stepFrom.y) * this.stepT;
    }
  }

  private arriveAt(x: number, y: number, fromX: number, fromY: number): boolean {
    const o = this.state.map.objectAt(x, y);
    if (!o) return false;
    switch (o.type) {
      case "resource": {
        addBag(this.state.resources, { [o.resKind!]: o.amount! });
        this.state.pushLog(`Found ${o.amount} ${o.resKind}.`);
        Sfx.coin();
        this.state.map.removeObject(o);
        return false;
      }
      case "chest": {
        this.state.resources.gold += o.amount!;
        this.state.hero.gainExp(Math.floor(o.amount! / 4));
        this.state.pushLog(`A treasure chest holds ${o.amount} gold!`);
        Sfx.coin();
        this.state.map.removeObject(o);
        return false;
      }
      case "sign":
        this.modal = { title: "Signpost", body: o.text ?? "" };
        return false;
      case "mine":
        this.handleMine(o, fromX, fromY);
        return true;
      case "monster":
        this.handleMonster(o);
        return true;
      case "castle":
        this.state.hero.x = fromX; this.state.hero.y = fromY;
        this.state.hero.fx = fromX; this.state.hero.fy = fromY;
        this.app.openTown();
        return true;
      case "stronghold":
        this.handleStronghold(o, fromX, fromY);
        return true;
      default:
        return false;
    }
  }

  private handleMine(o: MapObject, fromX: number, fromY: number): void {
    const claim = () => {
      o.owner = "player";
      o.guard = undefined;
      this.state.pushLog(`Captured the ${o.name}.`);
      this.state.hero.x = fromX; this.state.hero.y = fromY;
      this.state.hero.fx = fromX; this.state.hero.fy = fromY;
    };
    if (o.guard && o.guard.length) {
      this.fightThen(o.guard, o.name ?? "Guards", (won) => {
        if (won) claim();
        else this.handleLoss();
      });
    } else {
      claim();
      this.app.toAdventure();
    }
  }

  private handleMonster(o: MapObject): void {
    this.fightThen(o.guard ?? [], CREATURES[o.guard?.[0].id ?? "goblin"].name, (won) => {
      if (won) {
        if (o.reward) { addBag(this.state.resources, o.reward); }
        this.state.map.removeObject(o);
        this.state.pushLog("The enemy stack is vanquished.");
      } else this.handleLoss();
    });
  }

  private handleStronghold(o: MapObject, fromX: number, fromY: number): void {
    const keepName = o.name ?? "the enemy keep";
    this.fightThen(o.guard ?? [], o.name ?? "Stronghold", (won) => {
      if (won) {
        this.state.phase = "won";
        this.state.pushLog(`${keepName} has fallen! Victory!`);
        Sfx.win();
      } else {
        this.state.hero.x = fromX; this.state.hero.y = fromY;
        this.handleLoss();
      }
    });
  }

  private fightThen(enemy: Stack[], name: string, cb: (won: boolean) => void): void {
    const power = armyPower(enemy.map((s) => s));
    this.app.startBattle(
      enemy,
      Math.max(1, Math.round(power / 600)),
      Math.max(1, Math.round(power / 800)),
      name,
      (outcome) => {
        if (outcome.playerWon) {
          const before = this.state.hero.level;
          this.state.hero.gainExp(Math.max(50, Math.round(power / 4)));
          if (this.state.hero.level > before) {
            this.state.pushLog(`${this.state.hero.name} reached level ${this.state.hero.level}!`);
          }
        }
        cb(outcome.playerWon);
        this.app.toAdventure();
      },
    );
  }

  private handleLoss(): void {
    if (armyIsEmpty(this.state.hero.army)) {
      this.state.phase = "lost";
      this.state.pushLog("Your hero's army was destroyed...");
      Sfx.lose();
    }
  }

  // ---------------- drawing ----------------
  draw(r: Renderer): void {
    const ctx = r.ctx;
    const L = this.layout();
    r.clear("#101508");
    this.drawMap(ctx, L);

    // pending march pills (above the bar, below the map)
    if (this.pending && !this.sheetOpen && this.state.phase === "playing") this.drawMarchPills(ctx, L);

    // overlays
    drawResourceBar(ctx, this.state, 0, 0, L.vw, L.topH);
    this.drawActionBar(ctx, L);

    if (this.sheetOpen) this.drawSheet(ctx, L);
    if (this.modal) this.drawModal(ctx, L);
    if (this.state.phase !== "playing") this.drawEndScreen(ctx, L);
  }

  private drawMap(ctx: CanvasRenderingContext2D, L: Layout): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, L.vw, L.vh);
    ctx.clip();
    ctx.scale(L.zoom, L.zoom);

    const map = this.state.map;
    const vis = this.visibleWorld(L);
    const x0 = Math.floor(this.camX / TILE);
    const y0 = Math.floor(this.camY / TILE);
    const x1 = Math.ceil((this.camX + vis.w) / TILE);
    const y1 = Math.ceil((this.camY + vis.h) / TILE);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!map.inBounds(x, y)) continue;
        const sx = x * TILE - this.camX;
        const sy = y * TILE - this.camY;
        const variant = (x * 7 + y * 13) % 6;
        const tile = terrainTileFor(map.terrainAt(x, y), variant, this.waterFrame);
        ctx.drawImage(tile, sx, sy);
      }
    }

    const visObjs = map.objects
      .filter((o) => o.x >= x0 - 2 && o.x <= x1 + 2 && o.y >= y0 - 2 && o.y <= y1 + 2 && this.state.fog.isRevealed(o.x, o.y))
      .sort((a, b) => a.y - b.y);
    for (const o of visObjs) this.drawObject(ctx, o);

    this.drawHero(ctx);
    this.drawPreview(ctx);
    this.drawFog(ctx, x0, y0, x1, y1);

    ctx.restore();
  }

  private objScreen(o: MapObject): { sx: number; sy: number } {
    return { sx: o.x * TILE - this.camX, sy: o.y * TILE - this.camY };
  }

  private drawObject(ctx: CanvasRenderingContext2D, o: MapObject): void {
    const { sx, sy } = this.objScreen(o);
    const cx = sx + TILE / 2;
    const bottom = sy + TILE - 2;
    const blit = (img: HTMLCanvasElement) => ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(bottom - img.height));
    switch (o.type) {
      case "castle": blit(castleSprite(o.owner ?? "player", o.faction)); break;
      case "stronghold": blit(strongholdSprite(o.faction)); break;
      case "mine":
        blit(mineSprite(o.mineKind!));
        ctx.drawImage(flagSprite(o.owner ?? "neutral"), Math.round(cx + 12), Math.round(bottom - 40));
        break;
      case "resource": blit(resourcePile(o.resKind!)); break;
      case "chest": blit(chestSprite()); break;
      case "sign": blit(signSprite()); break;
      case "tree": blit(bigTree(o.variant ?? 0)); break;
      case "rock": blit(bigRock()); break;
      case "monster": {
        const spr = creatureSprite(o.guard?.[0].id ?? "goblin");
        spr.drawCenteredBottom(ctx, cx, bottom, 2);
        const total = (o.guard ?? []).reduce((n, s) => n + s.count, 0);
        panel(ctx, cx - 12, bottom + 1, 24, 13, "#3a2410", "#5b3a1a", "#1c1208");
        text(ctx, String(total), cx, bottom + 11, "#fff0c8", "bold 11px 'Trebuchet MS'", "center");
        break;
      }
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D): void {
    const h = this.state.hero;
    const spr = heroSprite(this.state.town.faction);
    const cx = h.fx * TILE - this.camX + TILE / 2;
    const bottom = h.fy * TILE - this.camY + TILE - 2;
    const scale = 2;
    const w = spr.w * scale;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx, bottom - 2, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (h.facing === 1) spr.draw(ctx, Math.round(cx - w / 2), Math.round(bottom - spr.h * scale), scale);
    else spr.drawFlipped(ctx, Math.round(cx - w / 2), Math.round(bottom - spr.h * scale), scale);
  }

  private drawPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.previewPath || this.moving) return;
    let acc = 0;
    const mp = this.state.hero.movePoints;
    for (const t of this.previewPath) {
      acc += t.cost;
      const sx = t.x * TILE - this.camX + TILE / 2;
      const sy = t.y * TILE - this.camY + TILE / 2;
      const reachable = acc <= mp;
      ctx.fillStyle = reachable ? "rgba(120,230,120,0.9)" : "rgba(230,170,90,0.85)";
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const last = this.previewPath[this.previewPath.length - 1];
    if (last) {
      const sx = last.x * TILE - this.camX + TILE / 2;
      const sy = last.y * TILE - this.camY + TILE / 2;
      ctx.strokeStyle = "#fff0c8";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 14, sy - 14, 28, 28);
    }
  }

  private drawFog(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!this.state.map.inBounds(x, y)) continue;
        if (this.state.fog.isRevealed(x, y)) continue;
        const sx = x * TILE - this.camX;
        const sy = y * TILE - this.camY;
        ctx.fillStyle = "#0a0c06";
        ctx.fillRect(sx, sy, TILE, TILE);
      }
    }
  }

  // ---------------- overlays ----------------
  private drawActionBar(ctx: CanvasRenderingContext2D, L: Layout): void {
    glass(ctx, 0, L.vh - L.barH, L.vw, L.barH, 0, 0.66);
    const playing = this.state.phase === "playing";
    L.btnArmy.enabled = playing;
    L.btnEnd.enabled = playing;
    L.btnCastle.enabled = playing;
    button(ctx, L.btnArmy, false);
    button(ctx, L.btnEnd, false);
    button(ctx, L.btnCastle, false);
    // movement points hint over the End Turn button
    const mp = this.state.hero.movePoints;
    text(ctx, `${mp} mp left`, L.btnEnd.x + L.btnEnd.w / 2, L.btnEnd.y - 6, "#e8d6a4", "11px 'Trebuchet MS'", "center");
  }

  private drawMarchPills(ctx: CanvasRenderingContext2D, L: Layout): void {
    let cost = 0;
    if (this.previewPath) for (const t of this.previewPath) cost += t.cost;
    const reachable = cost <= this.state.hero.movePoints;
    const m = L.march;
    button(ctx, { ...m, label: reachable ? "▶  March" : "▶  March (far)", primary: true }, false);
    text(ctx, reachable ? `${cost} mp` : `needs ${cost} mp`, m.x + m.w / 2, m.y - 6,
      reachable ? "#bfe89a" : "#e8b87a", "11px 'Trebuchet MS'", "center");
    button(ctx, { ...L.cancel, label: "✕" }, false);
  }

  // ----- Army / minimap pull-up sheet -----
  private sheetCloseRect(L: Layout): Rect {
    return { x: L.vw - 48, y: L.sheetY + 10, w: 36, h: 36 };
  }

  private drawSheet(ctx: CanvasRenderingContext2D, L: Layout): void {
    // dim the map above the sheet
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, L.vw, L.sheetY);
    const y = L.sheetY, h = L.vh - L.sheetY;
    panel(ctx, 0, y, L.vw, h);
    const pad = 14;
    // grab handle
    ctx.fillStyle = "rgba(255,240,200,0.4)";
    roundRectPath(ctx, L.vw / 2 - 24, y + 6, 48, 4, 2);
    ctx.fill();
    // close button
    const close = this.sheetCloseRect(L);
    button(ctx, { ...close, label: "✕" }, false);

    const h0 = this.state.hero;
    // hero card
    const cardW = Math.min(360, L.vw - pad * 2);
    parchment(ctx, pad, y + 18, cardW, 104);
    heroSprite(this.state.town.faction).draw(ctx, pad + 10, y + 30, 4);
    textShadow(ctx, h0.name, pad + 74, y + 40, "#3a2410", "bold 17px 'Trebuchet MS'");
    heroBadge(ctx, h0, pad + 74, y + 56, cardW - 90, { dark: false, bar: true });
    const mvFrac = h0.movePoints / h0.maxMovePoints;
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(pad + 74, y + 86, cardW - 90, 10);
    ctx.fillStyle = mvFrac > 0.25 ? "#4f8a3a" : "#c8413a";
    ctx.fillRect(pad + 75, y + 87, (cardW - 92) * mvFrac, 8);

    // army row
    const ay = y + 138;
    text(ctx, "Army", pad, ay - 4, "#fff0c8", "bold 14px 'Trebuchet MS'");
    const cols = 5;
    const slotW = (Math.min(420, L.vw - pad * 2) - (cols - 1) * 6) / cols;
    for (let i = 0; i < cols; i++) {
      const sx = pad + i * (slotW + 6);
      panel(ctx, sx, ay, slotW, 56, "#5b4a36", "#6a5a44", "#2a1d10");
      const s = this.state.hero.army[i];
      if (s && s.count > 0) {
        const spr = creatureSprite(s.id);
        const sc = Math.max(1, Math.floor(Math.min((slotW - 10) / spr.w, 32 / spr.h)));
        spr.drawCenteredBottom(ctx, sx + slotW / 2, ay + 40, sc);
        textShadow(ctx, String(s.count), sx + slotW / 2, ay + 53, "#fff0c8", "bold 13px 'Trebuchet MS'", "center");
      }
    }

    // minimap + log share the remaining space
    const restY = ay + 70;
    const restH = (L.vh) - restY - pad;
    const mmSize = Math.max(60, Math.min(restH, L.portrait ? L.vw - pad * 2 - 0 : 200, 220));
    this.drawMinimap(ctx, pad, restY, mmSize);
    // recent log to the right of / below the minimap
    const logX = pad + mmSize + 14;
    if (logX < L.vw - 40) {
      const lines = this.state.log.slice(-Math.max(3, Math.floor(restH / 18)));
      let ly = restY + 14;
      for (const line of lines) {
        ly = wrapText(ctx, line, logX, ly, L.vw - logX - pad, 16, "#e8d6a4", "12px 'Trebuchet MS'");
        ly += 2;
        if (ly > L.vh - pad) break;
      }
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, x: number, yy: number, size: number): void {
    panel(ctx, x - 4, yy - 4, size + 8, size + 8, "#2a1d10", "#3a2410", "#1c1208");
    const map = this.state.map;
    const cell = size / map.width;
    for (let y = 0; y < map.height; y++) {
      for (let xx = 0; xx < map.width; xx++) {
        ctx.fillStyle = !this.state.fog.isRevealed(xx, y) ? "#1a140c" : (TERRAIN_COLOR[map.terrainAt(xx, y)] ?? "#4f8a3a");
        ctx.fillRect(x + xx * cell, yy + y * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    for (const o of map.objects) {
      if (!this.state.fog.isRevealed(o.x, o.y)) continue;
      let col: string | null = null;
      if (o.type === "castle") col = "#6fb0e6";
      else if (o.type === "stronghold") col = "#c8413a";
      else if (o.type === "mine") col = o.owner === "player" ? "#6fb0e6" : "#f2c44d";
      if (col) { ctx.fillStyle = col; ctx.fillRect(x + o.x * cell - 1, yy + o.y * cell - 1, 3, 3); }
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + this.state.hero.fx * cell - 1, yy + this.state.hero.fy * cell - 1, 3, 3);
  }

  // ----- modal + end screen -----
  private drawModal(ctx: CanvasRenderingContext2D, L: Layout): void {
    const m = this.modal!;
    const w = Math.min(460, L.vw - 32);
    const h = m.title ? 200 : 150;
    const x = (L.vw - w) / 2, y = (L.vh - h) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, L.vw, L.vh);
    parchment(ctx, x, y, w, h);
    if (m.title) textShadow(ctx, m.title, x + w / 2, y + 36, "#5b2a10", "bold 22px 'Trebuchet MS'", "center");
    wrapText(ctx, m.body, x + 24, y + (m.title ? 70 : 50), w - 48, 24, "#3a2410", "16px 'Trebuchet MS'");
    text(ctx, "(tap to continue)", x + w / 2, y + h - 18, "#7a5a30", "12px 'Trebuchet MS'", "center");
  }

  private endScreenButton(L: Layout): Button {
    return { x: L.vw / 2 - 100, y: L.vh / 2 + 44, w: 200, h: 52, label: "New Quest", primary: true };
  }

  private drawEndScreen(ctx: CanvasRenderingContext2D, L: Layout): void {
    const won = this.state.phase === "won";
    ctx.fillStyle = won ? "rgba(20,40,12,0.78)" : "rgba(40,12,12,0.78)";
    ctx.fillRect(0, 0, L.vw, L.vh);
    const titleSize = Math.round(Math.min(64, L.vw * 0.13));
    textShadow(ctx, won ? "VICTORY!" : "DEFEAT", L.vw / 2, L.vh / 2 - 30,
      won ? "#f2e4a0" : "#e8a0a0", `bold ${titleSize}px 'Trebuchet MS'`, "center");
    const sub = won
      ? `The enemy keep is yours. The realm of ${this.state.town.name} is safe!`
      : "Your hero has fallen. The dark lord prevails...";
    wrapText(ctx, sub, L.vw / 2 - Math.min(220, L.vw / 2 - 16), L.vh / 2 + 8,
      Math.min(440, L.vw - 32), 24, "#f2e4c0", "17px 'Trebuchet MS'");
    button(ctx, this.endScreenButton(L), false);
  }
}
