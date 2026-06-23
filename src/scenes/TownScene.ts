// Town (castle) scene: painted backdrop with clickable buildings. Build from the
// tree, recruit creatures into the hero's army, and trade at the marketplace.
import type { App } from "../app";
import { Scene } from "../engine/scene";
import { Renderer, VW, VH } from "../engine/renderer";
import { Input } from "../engine/input";
import { Sfx } from "../engine/audio";
import { BUILDINGS, BUILDING_ORDER, BuildingId } from "../data/buildings";
import { CREATURES, CreatureId } from "../data/creatures";
import { RESOURCE_ORDER, RESOURCE_LABEL, ResourceKind } from "../data/resources";
import { build, canBuild, recruit, maxAffordable, sellResource, SELL_RATE } from "../game/economy";
import { townBackground, buildingArt } from "../art/sprites_town";
import { creatureSprite } from "../art/sprites_creatures";
import { resourceIcon } from "../art/sprites_ui";
import { drawHud, HUD_H } from "../ui/hud";
import { Button, button, panel, parchment, pointInRect, text, textShadow, wrapText, Rect } from "../ui/widgets";

const ARMY_H = 72;
const TOWN_H = VH - HUD_H - ARMY_H;

type Modal =
  | { kind: "build"; id: BuildingId }
  | { kind: "recruit"; cid: CreatureId; qty: number }
  | { kind: "market" }
  | { kind: "info"; title: string; body: string }
  | null;

export class TownScene implements Scene {
  private modal: Modal = null;
  private hover: BuildingId | null = null;
  private btnLeave: Button = { x: VW - 150, y: VH - HUD_H - ARMY_H + 16, w: 134, h: 40, label: "Leave Town" };

  constructor(private app: App) {}
  private get state() { return this.app.state; }

  private buildingRect(id: BuildingId): Rect {
    const b = BUILDINGS[id];
    const art = buildingArt(id);
    return { x: b.anchor.x - art.width / 2, y: b.anchor.y - art.height, w: art.width, h: art.height };
  }

  update(_dt: number, input: Input): void {
    const p = input.pointer;
    this.hover = null;
    if (!this.modal && p.y < TOWN_H) {
      // topmost (largest y anchor first) building under cursor
      for (const id of [...BUILDING_ORDER].reverse()) {
        if (pointInRect(p.x, p.y, this.buildingRect(id))) { this.hover = id; break; }
      }
    }
    for (const c of input.takeClicks()) this.handleClick(c.x, c.y);
    for (const k of input.takeKeys()) if (k === "Escape") { if (this.modal) this.modal = null; else this.app.toAdventure(); }
  }

  private handleClick(px: number, py: number): void {
    Sfx.click();
    if (this.modal) { this.handleModalClick(px, py); return; }
    if (pointInRect(px, py, this.btnLeave)) { this.app.toAdventure(); return; }
    if (py >= TOWN_H) return;
    for (const id of [...BUILDING_ORDER].reverse()) {
      if (!pointInRect(px, py, this.buildingRect(id))) continue;
      this.openBuilding(id);
      return;
    }
  }

  private openBuilding(id: BuildingId): void {
    const b = BUILDINGS[id];
    if (!this.state.town.built.has(id)) { this.modal = { kind: "build", id }; return; }
    if (b.dwelling) { this.modal = { kind: "recruit", cid: b.dwelling, qty: 1 }; return; }
    if (b.enablesMarket) { this.modal = { kind: "market" }; return; }
    this.modal = { kind: "info", title: b.name, body: b.desc };
  }

  // ---- modal interactions ----
  private modalButtons(): { rect: Rect; act: () => void; label: string; enabled?: boolean }[] {
    const m = this.modal;
    if (!m) return [];
    const w = 480, h = 280;
    const x = (VW - w) / 2, y = (VH - h) / 2;
    const out: { rect: Rect; act: () => void; label: string; enabled?: boolean }[] = [];
    if (m.kind === "build") {
      const ok = canBuild(this.state, m.id).ok;
      out.push({ rect: { x: x + 60, y: y + h - 56, w: 150, h: 40 }, label: "Build", enabled: ok, act: () => {
        if (build(this.state, m.id)) { Sfx.build(); this.modal = null; } } });
      out.push({ rect: { x: x + w - 210, y: y + h - 56, w: 150, h: 40 }, label: "Cancel", act: () => (this.modal = null) });
    } else if (m.kind === "recruit") {
      const maxN = Math.min(this.state.town.available[m.cid] ?? 0, maxAffordable(this.state, m.cid));
      out.push({ rect: { x: x + 40, y: y + 150, w: 36, h: 36 }, label: "-", act: () => (m.qty = Math.max(1, m.qty - 1)) });
      out.push({ rect: { x: x + 120, y: y + 150, w: 36, h: 36 }, label: "+", act: () => (m.qty = Math.min(Math.max(1, maxN), m.qty + 1)) });
      out.push({ rect: { x: x + 168, y: y + 150, w: 60, h: 36 }, label: "Max", act: () => (m.qty = Math.max(1, maxN)) });
      out.push({ rect: { x: x + 60, y: y + h - 56, w: 150, h: 40 }, label: "Recruit", enabled: maxN > 0, act: () => {
        if (recruit(this.state, m.cid, m.qty, this.state.hero.army)) { Sfx.coin(); this.modal = null; } } });
      out.push({ rect: { x: x + w - 210, y: y + h - 56, w: 150, h: 40 }, label: "Close", act: () => (this.modal = null) });
    } else if (m.kind === "market") {
      RESOURCE_ORDER.filter((k) => k !== "gold").forEach((k, i) => {
        const ry = y + 70 + i * 32;
        out.push({ rect: { x: x + w - 200, y: ry - 18, w: 80, h: 26 }, label: "Sell 1", enabled: this.state.resources[k] >= 1, act: () => { sellResource(this.state, k, 1); Sfx.coin(); } });
        out.push({ rect: { x: x + w - 110, y: ry - 18, w: 90, h: 26 }, label: "Sell 5", enabled: this.state.resources[k] >= 5, act: () => { sellResource(this.state, k, 5); Sfx.coin(); } });
      });
      out.push({ rect: { x: x + w / 2 - 75, y: y + h - 52, w: 150, h: 38 }, label: "Close", act: () => (this.modal = null) });
    } else if (m.kind === "info") {
      out.push({ rect: { x: x + w / 2 - 75, y: y + h - 56, w: 150, h: 40 }, label: "Close", act: () => (this.modal = null) });
    }
    return out;
  }

  private handleModalClick(px: number, py: number): void {
    for (const b of this.modalButtons()) {
      if (b.enabled === false) continue;
      if (pointInRect(px, py, b.rect)) { b.act(); return; }
    }
  }

  // ---------------- drawing ----------------
  draw(r: Renderer): void {
    const ctx = r.ctx;
    ctx.drawImage(townBackground(VW, TOWN_H), 0, 0);

    // title banner
    panel(ctx, VW / 2 - 130, 8, 260, 34, "#6b4a24", "#8a6432", "#3a2410");
    textShadow(ctx, this.state.town.name, VW / 2, 32, "#fff0c8", "bold 20px 'Trebuchet MS'", "center");

    for (const id of BUILDING_ORDER) this.drawBuilding(ctx, id);

    // army strip
    this.drawArmyStrip(ctx);
    drawHud(ctx, this.state, VW, VH);
    button(ctx, this.btnLeave, false);

    // hover tooltip
    if (this.hover) this.drawTooltip(ctx, this.hover);

    if (this.modal) this.drawModal(ctx);
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, id: BuildingId): void {
    const art = buildingArt(id);
    const rect = this.buildingRect(id);
    const built = this.state.town.built.has(id);
    if (!built) {
      ctx.globalAlpha = 0.28;
      ctx.drawImage(art, rect.x, rect.y);
      ctx.globalAlpha = 1;
      // build marker
      const can = canBuild(this.state, id).ok;
      panel(ctx, rect.x + rect.w / 2 - 12, rect.y + rect.h / 2 - 12, 24, 24, can ? "#4f8a3a" : "#7d3a3a", "#79b85a", "#1c1208");
      text(ctx, "+", rect.x + rect.w / 2, rect.y + rect.h / 2 + 6, "#fff0c8", "bold 18px 'Trebuchet MS'", "center");
    } else {
      ctx.drawImage(art, rect.x, rect.y);
      if (this.hover === id) {
        ctx.strokeStyle = "rgba(255,240,176,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
    }
  }

  private drawTooltip(ctx: CanvasRenderingContext2D, id: BuildingId): void {
    const b = BUILDINGS[id];
    const built = this.state.town.built.has(id);
    const lines = [b.name, built ? b.desc : `Cost: ${costStr(b.cost)}`];
    const w = 240;
    const x = Math.min(VW - w - 8, Math.max(8, this.app.input.pointer.x + 14));
    const y = Math.max(8, this.app.input.pointer.y - 50);
    parchment(ctx, x, y, w, 56);
    textShadow(ctx, lines[0], x + 12, y + 22, "#5b2a10", "bold 15px 'Trebuchet MS'");
    wrapText(ctx, lines[1], x + 12, y + 40, w - 24, 16, "#3a2410", "12px 'Trebuchet MS'");
  }

  private drawArmyStrip(ctx: CanvasRenderingContext2D): void {
    const y = TOWN_H;
    panel(ctx, 0, y, VW, ARMY_H);
    text(ctx, "Hero's Army", 16, y + 20, "#fff0c8", "bold 14px 'Trebuchet MS'");
    const slotW = 88;
    for (let i = 0; i < 5; i++) {
      const sx = 16 + i * (slotW + 8);
      const sy = y + 26;
      panel(ctx, sx, sy, slotW, 38, "#5b4a36", "#6a5a44", "#2a1d10");
      const s = this.state.hero.army[i];
      if (s && s.count > 0) {
        const spr = creatureSprite(s.id);
        spr.drawCenteredBottom(ctx, sx + 24, sy + 34, 2);
        text(ctx, CREATURES[s.id].name, sx + 40, sy + 16, "#fff0c8", "11px 'Trebuchet MS'");
        text(ctx, `x${s.count}`, sx + 40, sy + 32, "#f2c44d", "bold 13px 'Trebuchet MS'");
      }
    }
    if (this.state.town.builtToday) text(ctx, "Already built today", VW - 320, y + 20, "#e8a0a0", "12px 'Trebuchet MS'");
  }

  // ---- modals ----
  private drawModal(ctx: CanvasRenderingContext2D): void {
    const m = this.modal!;
    const w = 480, h = 280;
    const x = (VW - w) / 2, y = (VH - h) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, VW, VH);
    parchment(ctx, x, y, w, h);

    if (m.kind === "build") this.drawBuildModal(ctx, x, y, w, m.id);
    else if (m.kind === "recruit") this.drawRecruitModal(ctx, x, y, m);
    else if (m.kind === "market") this.drawMarketModal(ctx, x, y, w, h);
    else if (m.kind === "info") {
      textShadow(ctx, m.title, x + w / 2, y + 40, "#5b2a10", "bold 22px 'Trebuchet MS'", "center");
      wrapText(ctx, m.body, x + 30, y + 80, w - 60, 24, "#3a2410", "16px 'Trebuchet MS'");
    }
    for (const b of this.modalButtons()) button(ctx, { ...b.rect, label: b.label, enabled: b.enabled }, false);
  }

  private drawBuildModal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, id: BuildingId): void {
    const b = BUILDINGS[id];
    ctx.drawImage(buildingArt(id), x + 24, y + 50);
    textShadow(ctx, b.name, x + 160, y + 56, "#5b2a10", "bold 22px 'Trebuchet MS'");
    wrapText(ctx, b.desc, x + 160, y + 86, w - 190, 22, "#3a2410", "15px 'Trebuchet MS'");
    text(ctx, "Cost:", x + 160, y + 150, "#5b3a1a", "bold 14px 'Trebuchet MS'");
    this.drawCostRow(ctx, b.cost, x + 210, y + 142);
    const reason = canBuild(this.state, id).reason;
    if (reason) text(ctx, reason, x + 160, y + 178, "#9c3a2a", "13px 'Trebuchet MS'");
  }

  private drawRecruitModal(ctx: CanvasRenderingContext2D, x: number, y: number, m: { cid: CreatureId; qty: number }): void {
    const c = CREATURES[m.cid];
    const spr = creatureSprite(m.cid);
    parchment(ctx, x + 24, y + 40, 96, 96);
    spr.drawCenteredBottom(ctx, x + 72, y + 128, 4);
    textShadow(ctx, c.name, x + 140, y + 60, "#5b2a10", "bold 22px 'Trebuchet MS'");
    text(ctx, `Atk ${c.atk}  Def ${c.def}  HP ${c.hp}`, x + 140, y + 86, "#3a2410", "14px 'Trebuchet MS'");
    text(ctx, `Damage ${c.dmgMin}-${c.dmgMax}  Speed ${c.speed}${c.shots ? "  Shots " + c.shots : ""}`, x + 140, y + 106, "#3a2410", "14px 'Trebuchet MS'");
    const avail = this.state.town.available[m.cid] ?? 0;
    text(ctx, `Available: ${avail}`, x + 140, y + 130, "#5b3a1a", "bold 14px 'Trebuchet MS'");
    // quantity box
    panel(ctx, x + 80, y + 150, 36, 36, "#d8c089", "#ece0b8", "#9c7c44");
    text(ctx, String(m.qty), x + 98, y + 174, "#3a2410", "bold 18px 'Trebuchet MS'", "center");
    text(ctx, "Total cost:", x + 240, y + 168, "#5b3a1a", "bold 14px 'Trebuchet MS'");
    this.drawCostRow(ctx, scaleCost(c.cost, m.qty), x + 330, y + 162);
  }

  private drawMarketModal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _h: number): void {
    void w;
    textShadow(ctx, "Marketplace", x + 240, y + 36, "#5b2a10", "bold 22px 'Trebuchet MS'", "center");
    RESOURCE_ORDER.filter((k) => k !== "gold").forEach((k, i) => {
      const ry = y + 70 + i * 32;
      ctx.drawImage(resourceIcon(k), x + 30, ry - 16);
      text(ctx, RESOURCE_LABEL[k], x + 56, ry, "#3a2410", "14px 'Trebuchet MS'");
      text(ctx, `Have: ${this.state.resources[k]}`, x + 150, ry, "#5b3a1a", "13px 'Trebuchet MS'");
      text(ctx, `= ${SELL_RATE[k]}g`, x + 270, ry, "#a8761f", "13px 'Trebuchet MS'");
    });
  }

  private drawCostRow(ctx: CanvasRenderingContext2D, cost: Partial<Record<ResourceKind, number>>, x: number, y: number): void {
    let cx = x;
    for (const k of RESOURCE_ORDER) {
      const v = cost[k];
      if (!v) continue;
      ctx.drawImage(resourceIcon(k), cx, y);
      const lacking = this.state.resources[k] < v;
      text(ctx, String(v), cx + 20, y + 14, lacking ? "#9c3a2a" : "#3a2410", "bold 14px 'Trebuchet MS'");
      cx += 20 + ctx.measureText(String(v)).width + 14;
    }
  }
}

function costStr(cost: Partial<Record<ResourceKind, number>>): string {
  return RESOURCE_ORDER.filter((k) => cost[k]).map((k) => `${cost[k]} ${k}`).join(", ");
}
function scaleCost(cost: Record<ResourceKind, number>, n: number): Partial<Record<ResourceKind, number>> {
  const out: Partial<Record<ResourceKind, number>> = {};
  for (const k of RESOURCE_ORDER) if (cost[k]) out[k] = cost[k] * n;
  return out;
}
