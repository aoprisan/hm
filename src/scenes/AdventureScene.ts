// Adventure map scene: scrolling terrain, click-to-move hero with pathfinding,
// fog of war, object interaction (pickups / mines / town / battles), HUD + panel.
import type { App } from "../app";
import { Scene } from "../engine/scene";
import { Renderer, VW, VH } from "../engine/renderer";
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
import { drawHud, HUD_H } from "../ui/hud";
import { drawSidePanel } from "../ui/sidepanel";
import { Button, button, panel, parchment, pointInRect, text, textShadow, wrapText, Rect } from "../ui/widgets";

const MAPVIEW: Rect = { x: 0, y: 0, w: 780, h: VH - HUD_H };
const PANEL: Rect = { x: 780, y: 0, w: VW - 780, h: VH - HUD_H };

interface Modal {
  title: string;
  body: string;
  onClose?: () => void;
}

export class AdventureScene implements Scene {
  private camX = 0;
  private camY = 0;
  private hoverTile = { x: -1, y: -1 };
  private previewPath: PathTile[] | null = null;
  private waterAnim = 0;
  private waterFrame = 0;
  // stepping animation
  private moving = false;
  private stepFrom = { x: 0, y: 0 };
  private stepTo = { x: 0, y: 0 };
  private stepT = 0;
  private stepCost = 0;
  private modal: Modal | null = null;

  private btnEndTurn: Button = { x: PANEL.x + 14, y: PANEL.h - 50, w: PANEL.w - 28, h: 38, label: "End Turn" };
  private btnCastle: Button = { x: PANEL.x + 14, y: PANEL.h - 96, w: PANEL.w - 28, h: 38, label: "Visit Castle" };

  constructor(private app: App) {}

  enter(): void {
    this.centerOnHero(true);
  }

  private get state() { return this.app.state; }

  private centerOnHero(snap = false): void {
    const h = this.state.hero;
    const tx = h.fx * TILE + TILE / 2 - MAPVIEW.w / 2;
    const ty = h.fy * TILE + TILE / 2 - MAPVIEW.h / 2;
    const maxX = this.state.map.width * TILE - MAPVIEW.w;
    const maxY = this.state.map.height * TILE - MAPVIEW.h;
    const cx = Math.max(0, Math.min(maxX, tx));
    const cy = Math.max(0, Math.min(maxY, ty));
    if (snap) { this.camX = cx; this.camY = cy; }
    else { this.camX += (cx - this.camX) * 0.18; this.camY += (cy - this.camY) * 0.18; }
  }

  private screenToTile(px: number, py: number): { x: number; y: number } {
    return { x: Math.floor((px + this.camX) / TILE), y: Math.floor((py + this.camY) / TILE) };
  }

  private castleAdjacent(): boolean {
    const h = this.state.hero, t = this.state.town;
    return Math.max(Math.abs(h.x - t.x), Math.abs(h.y - t.y)) <= 1;
  }

  update(dt: number, input: Input): void {
    this.waterAnim += dt;
    if (this.waterAnim > 0.35) { this.waterAnim = 0; this.waterFrame++; }
    this.centerOnHero(false);

    // hover preview
    const p = input.pointer;
    if (pointInRect(p.x, p.y, MAPVIEW) && !this.moving && this.state.phase === "playing") {
      const t = this.screenToTile(p.x, p.y);
      if (t.x !== this.hoverTile.x || t.y !== this.hoverTile.y) {
        this.hoverTile = t;
        this.recomputePreview();
      }
    }

    // advance stepping animation
    if (this.moving) this.advanceStep(dt);

    for (const c of input.takeClicks()) this.handleClick(c.x, c.y);
    for (const k of input.takeKeys()) {
      if (k === "Enter" || k === " ") { if (!this.modal && this.state.phase === "playing") this.doEndTurn(); }
      if (k === "Escape") this.modal = null;
    }
  }

  private recomputePreview(): void {
    const h = this.state.hero;
    const t = this.hoverTile;
    if (!this.state.map.inBounds(t.x, t.y) || !this.state.fog.isRevealed(t.x, t.y)) {
      this.previewPath = null;
      return;
    }
    this.previewPath = findPath(this.state.map, h.x, h.y, t.x, t.y);
  }

  private handleClick(px: number, py: number): void {
    Sfx.click();
    if (this.modal) { const m = this.modal; this.modal = null; m.onClose?.(); return; }

    if (this.state.phase !== "playing") {
      // restart button hit-test
      if (pointInRect(px, py, { x: VW / 2 - 90, y: VH / 2 + 40, w: 180, h: 44 })) this.app.newGame();
      return;
    }

    // panel buttons
    if (pointInRect(px, py, this.btnEndTurn)) { this.doEndTurn(); return; }
    if (pointInRect(px, py, this.btnCastle)) {
      if (this.castleAdjacent()) this.app.openTown();
      else this.flash("Move your hero to the castle first.");
      return;
    }

    // map click -> move
    if (pointInRect(px, py, MAPVIEW) && !this.moving) {
      const t = this.screenToTile(px, py);
      if (!this.state.map.inBounds(t.x, t.y)) return;
      const path = findPath(this.state.map, this.state.hero.x, this.state.hero.y, t.x, t.y);
      if (path && path.length) { this.state.hero.path = path; this.startNextStep(); }
    }
  }

  private doEndTurn(): void {
    endTurn(this.state);
    this.state.hero.path = [];
    this.moving = false;
    this.recomputePreview();
  }

  private flash(msg: string): void {
    this.modal = { title: "", body: msg };
  }

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
      else { h.path = []; this.recomputePreview(); }
    } else {
      h.fx = this.stepFrom.x + (this.stepTo.x - this.stepFrom.x) * this.stepT;
      h.fy = this.stepFrom.y + (this.stepTo.y - this.stepFrom.y) * this.stepT;
    }
  }

  // Returns true if movement should stop here (interaction happened).
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
    this.fightThen(o.guard ?? [], o.name ?? "Stronghold", (won) => {
      if (won) {
        this.state.phase = "won";
        this.state.pushLog("Dragon's Keep has fallen! Victory!");
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
        if (outcome.playerWon) this.state.hero.gainExp(Math.max(50, Math.round(power / 4)));
        cb(outcome.playerWon);
        if (this.state.phase === "playing") this.app.toAdventure();
        else this.app.toAdventure();
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
    r.clear("#101508");
    this.drawMap(ctx);
    drawHud(ctx, this.state, VW, VH);
    drawSidePanel(ctx, this.state, PANEL, MAPVIEW, this.camX, this.camY);
    // panel buttons
    this.btnCastle.enabled = this.castleAdjacent();
    button(ctx, this.btnCastle, false);
    button(ctx, this.btnEndTurn, false);
    text(ctx, `Move: ${this.state.hero.movePoints}`, PANEL.x + 14, PANEL.h - 104, "#cfc7b8", "12px 'Trebuchet MS'");

    if (this.modal) this.drawModal(ctx);
    if (this.state.phase !== "playing") this.drawEndScreen(ctx);
  }

  private drawMap(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(MAPVIEW.x, MAPVIEW.y, MAPVIEW.w, MAPVIEW.h);
    ctx.clip();

    const map = this.state.map;
    const x0 = Math.floor(this.camX / TILE);
    const y0 = Math.floor(this.camY / TILE);
    const x1 = Math.ceil((this.camX + MAPVIEW.w) / TILE);
    const y1 = Math.ceil((this.camY + MAPVIEW.h) / TILE);

    // terrain
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

    // objects (sorted by y for proper overlap)
    const visObjs = map.objects
      .filter((o) => o.x >= x0 - 2 && o.x <= x1 + 2 && o.y >= y0 - 2 && o.y <= y1 + 2 && this.state.fog.isRevealed(o.x, o.y))
      .sort((a, b) => a.y - b.y);
    for (const o of visObjs) this.drawObject(ctx, o);

    // hero (draw in y-order roughly: after objects above it). Simplicity: draw on top.
    this.drawHero(ctx);

    // movement preview
    this.drawPreview(ctx);

    // fog overlay
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
      case "castle": blit(castleSprite(o.owner ?? "player")); break;
      case "stronghold": blit(strongholdSprite()); break;
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
        // count banner
        const total = (o.guard ?? []).reduce((n, s) => n + s.count, 0);
        panel(ctx, cx - 12, bottom + 1, 24, 13, "#3a2410", "#5b3a1a", "#1c1208");
        text(ctx, String(total), cx, bottom + 11, "#fff0c8", "bold 11px 'Trebuchet MS'", "center");
        break;
      }
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D): void {
    const h = this.state.hero;
    const cx = h.fx * TILE - this.camX + TILE / 2;
    const bottom = h.fy * TILE - this.camY + TILE - 2;
    const scale = 2;
    const w = heroSprite.w * scale;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx, bottom - 2, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (h.facing === 1) heroSprite.draw(ctx, Math.round(cx - w / 2), Math.round(bottom - heroSprite.h * scale), scale);
    else heroSprite.drawFlipped(ctx, Math.round(cx - w / 2), Math.round(bottom - heroSprite.h * scale), scale);
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
      ctx.fillStyle = reachable ? "rgba(120,230,120,0.85)" : "rgba(230,170,90,0.8)";
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // destination ring
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

  private drawModal(ctx: CanvasRenderingContext2D): void {
    const m = this.modal!;
    const w = 460, h = m.title ? 200 : 150;
    const x = (VW - w) / 2, y = (VH - h) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, VW, VH);
    parchment(ctx, x, y, w, h);
    if (m.title) textShadow(ctx, m.title, x + w / 2, y + 36, "#5b2a10", "bold 22px 'Trebuchet MS'", "center");
    wrapText(ctx, m.body, x + 28, y + (m.title ? 70 : 50), w - 56, 24, "#3a2410", "16px 'Trebuchet MS'");
    text(ctx, "(click to continue)", x + w / 2, y + h - 18, "#7a5a30", "12px 'Trebuchet MS'", "center");
  }

  private drawEndScreen(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.state.phase === "won" ? "rgba(20,40,12,0.7)" : "rgba(40,12,12,0.7)";
    ctx.fillRect(0, 0, VW, VH);
    const title = this.state.phase === "won" ? "VICTORY!" : "DEFEAT";
    textShadow(ctx, title, VW / 2, VH / 2 - 30, this.state.phase === "won" ? "#f2e4a0" : "#e8a0a0", "bold 56px 'Trebuchet MS'", "center");
    const sub = this.state.phase === "won"
      ? "Dragon's Keep is yours. The realm of Sunhaven is safe!"
      : "Your hero has fallen. The dark lord prevails...";
    text(ctx, sub, VW / 2, VH / 2 + 10, "#f2e4c0", "18px 'Trebuchet MS'", "center");
    const b: Button = { x: VW / 2 - 90, y: VH / 2 + 40, w: 180, h: 44, label: "New Quest" };
    button(ctx, b, false);
  }
}
