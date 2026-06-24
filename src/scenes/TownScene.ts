// Town (castle) scene, mobile-first: the painted town is "cover"-fit into the
// available area and can be dragged to scroll on narrow screens, so buildings
// stay large enough to tap. Build / recruit / market run through responsive,
// touch-sized modals. A bottom strip shows the hero's army + Leave button.
import type { App } from "../app";
import { Scene } from "../engine/scene";
import { Renderer } from "../engine/renderer";
import { Input } from "../engine/input";
import { Sfx } from "../engine/audio";
import { BuildingId } from "../data/buildings";
import { factionBuildings, factionOrder } from "../data/factions";
import { CREATURES, CreatureId } from "../data/creatures";
import { RESOURCE_ORDER, RESOURCE_LABEL, ResourceKind } from "../data/resources";
import { build, canBuild, recruit, maxAffordable, sellResource, SELL_RATE } from "../game/economy";
import { Army, transferStack } from "../game/army";
import { townBackground, buildingArt } from "../art/sprites_town";
import { creatureSprite } from "../art/sprites_creatures";
import { resourceIcon } from "../art/sprites_ui";
import { drawResourceBar, HUD_H } from "../ui/hud";
import { heroBadge } from "../ui/herobadge";
import { Button, button, panel, parchment, pointInRect, text, textShadow, wrapText, Rect } from "../ui/widgets";

const DESIGN_W = 1024;
const DESIGN_H = 524;

type Modal =
  | { kind: "build"; id: BuildingId }
  | { kind: "recruit"; cid: CreatureId; qty: number }
  | { kind: "market" }
  | { kind: "info"; title: string; body: string }
  | null;

interface Layout {
  vw: number; vh: number;
  topH: number; armyH: number; rowH: number;
  region: Rect;          // where the town art is drawn (clipped)
  scale: number;
  offX: number; offY: number; // art top-left in screen space (after pan)
  scrollW: number; scrollH: number; // pannable overflow
  btnLeave: Button;
}

interface ModalBtn { rect: Rect; act: () => void; label: string; enabled?: boolean; primary?: boolean; }

export class TownScene implements Scene {
  private modal: Modal = null;
  private hover: BuildingId | null = null;
  private camX = 0;
  private camY = 0;
  private centered = false;
  // selected army slot for garrison<->hero transfer (only when a hero is here)
  private selected: { side: "hero" | "garrison"; idx: number } | null = null;

  constructor(private app: App) {}
  private get state() { return this.app.state; }
  private get r(): Renderer { return this.app.renderer; }
  private get buildings() { return factionBuildings(this.state.town.faction); }
  private get order() { return factionOrder(this.state.town.faction); }
  // Is the hero standing on/adjacent to the town? Only then can troops be moved
  // between the hero and the garrison; otherwise the town is managed solo.
  private get heroHere(): boolean {
    const h = this.state.hero, t = this.state.town;
    return Math.max(Math.abs(h.x - t.x), Math.abs(h.y - t.y)) <= 1;
  }

  private layout(): Layout {
    const r = this.r;
    const vw = r.vw, vh = r.vh;
    const topH = HUD_H;
    const rowH = Math.round(Math.min(108, Math.max(84, vh * 0.16)));
    // two army rows (garrison + hero) when a hero is present, otherwise one.
    const armyH = this.heroHere ? rowH * 2 : rowH;
    const region: Rect = { x: 0, y: topH, w: vw, h: vh - topH - armyH };
    // "cover" fit so buildings stay sizeable; cap zoom on large screens.
    const scale = Math.min(1.6, Math.max(region.w / DESIGN_W, region.h / DESIGN_H));
    const tw = DESIGN_W * scale, th = DESIGN_H * scale;
    const scrollW = Math.max(0, tw - region.w);
    const scrollH = Math.max(0, th - region.h);
    this.camX = Math.max(0, Math.min(scrollW, this.camX));
    this.camY = Math.max(0, Math.min(scrollH, this.camY));
    const offX = region.x + (scrollW > 0 ? -this.camX : (region.w - tw) / 2);
    const offY = region.y + (scrollH > 0 ? -this.camY : (region.h - th) / 2);
    const btnLeave: Button = { x: vw - 132, y: vh - rowH + (rowH - 44) / 2, w: 120, h: 44, label: "Leave" };
    return { vw, vh, topH, armyH, rowH, region, scale, offX, offY, scrollW, scrollH, btnLeave };
  }

  private buildingRect(L: Layout, id: BuildingId): Rect {
    const b = this.buildings[id];
    const art = buildingArt(id, this.state.town.faction);
    return {
      x: L.offX + (b.anchor.x - art.width / 2) * L.scale,
      y: L.offY + (b.anchor.y - art.height) * L.scale,
      w: art.width * L.scale,
      h: art.height * L.scale,
    };
  }

  update(_dt: number, input: Input): void {
    const L = this.layout();
    if (!this.centered) { this.camX = L.scrollW / 2; this.camY = L.scrollH; this.centered = true; }

    const pan = input.takePan();
    if (!this.modal && (pan.dx || pan.dy)) { this.camX -= pan.dx; this.camY -= pan.dy; }

    const p = input.pointer;
    this.hover = null;
    if (!this.modal && pointInRect(p.x, p.y, L.region) && !input.isDragging) {
      for (const id of [...this.order].reverse()) {
        if (pointInRect(p.x, p.y, this.buildingRect(L, id))) { this.hover = id; break; }
      }
    }
    for (const c of input.takeClicks()) this.handleClick(L, c.x, c.y);
    for (const k of input.takeKeys()) if (k === "Escape") { if (this.modal) this.modal = null; else this.app.toAdventure(); }
  }

  private handleClick(L: Layout, px: number, py: number): void {
    Sfx.click();
    if (this.modal) { this.handleModalClick(px, py); return; }
    if (pointInRect(px, py, L.btnLeave)) { this.app.toAdventure(); return; }
    if (this.handleArmyClick(L, px, py)) return;
    if (!pointInRect(px, py, L.region)) return;
    for (const id of [...this.order].reverse()) {
      if (!pointInRect(px, py, this.buildingRect(L, id))) continue;
      this.openBuilding(id);
      return;
    }
  }

  private openBuilding(id: BuildingId): void {
    const b = this.buildings[id];
    if (!this.state.town.built.has(id)) { this.modal = { kind: "build", id }; return; }
    if (b.dwelling) { this.modal = { kind: "recruit", cid: b.dwelling, qty: 1 }; return; }
    if (b.enablesMarket) { this.modal = { kind: "market" }; return; }
    this.modal = { kind: "info", title: b.name, body: b.desc };
  }

  // ---- modal geometry ----
  private modalBox(L: Layout): Rect {
    const w = Math.min(460, L.vw - 24);
    const h = Math.min(L.vh - 24, this.modal?.kind === "market" ? 380 : 300);
    return { x: (L.vw - w) / 2, y: (L.vh - h) / 2, w, h };
  }

  private modalButtons(L: Layout): ModalBtn[] {
    const m = this.modal;
    if (!m) return [];
    const box = this.modalBox(L);
    const { x, y, w, h } = box;
    const by = y + h - 60, bh = 46;
    const out: ModalBtn[] = [];
    if (m.kind === "build") {
      const ok = canBuild(this.state, m.id).ok;
      const half = (w - 48) / 2;
      out.push({ rect: { x: x + 16, y: by, w: half, h: bh }, label: "Build", primary: true, enabled: ok, act: () => {
        if (build(this.state, m.id)) { Sfx.build(); this.app.save(); this.modal = null; } } });
      out.push({ rect: { x: x + 32 + half, y: by, w: half, h: bh }, label: "Cancel", act: () => (this.modal = null) });
    } else if (m.kind === "recruit") {
      const maxN = Math.min(this.state.town.available[m.cid] ?? 0, maxAffordable(this.state, m.cid));
      const qy = y + h - 124, qh = 44;
      out.push({ rect: { x: x + 16, y: qy, w: 48, h: qh }, label: "−", act: () => (m.qty = Math.max(1, m.qty - 1)) });
      out.push({ rect: { x: x + 120, y: qy, w: 48, h: qh }, label: "+", act: () => (m.qty = Math.min(Math.max(1, maxN), m.qty + 1)) });
      out.push({ rect: { x: x + 176, y: qy, w: 64, h: qh }, label: "Max", act: () => (m.qty = Math.max(1, maxN)) });
      const half = (w - 48) / 2;
      const target = this.heroHere ? this.state.hero.army : this.state.town.garrison;
      out.push({ rect: { x: x + 16, y: by, w: half, h: bh }, label: "Recruit", primary: true, enabled: maxN > 0, act: () => {
        if (recruit(this.state, m.cid, m.qty, target)) { Sfx.coin(); this.app.save(); this.modal = null; } } });
      out.push({ rect: { x: x + 32 + half, y: by, w: half, h: bh }, label: "Close", act: () => (this.modal = null) });
    } else if (m.kind === "market") {
      RESOURCE_ORDER.filter((k) => k !== "gold").forEach((k, i) => {
        const ry = y + 70 + i * 38;
        out.push({ rect: { x: x + w - 188, y: ry - 20, w: 80, h: 32 }, label: "Sell 1", enabled: this.state.resources[k] >= 1, act: () => { sellResource(this.state, k, 1); Sfx.coin(); } });
        out.push({ rect: { x: x + w - 98, y: ry - 20, w: 84, h: 32 }, label: "Sell 5", enabled: this.state.resources[k] >= 5, act: () => { sellResource(this.state, k, 5); Sfx.coin(); } });
      });
      out.push({ rect: { x: x + w / 2 - 80, y: by, w: 160, h: bh }, label: "Close", primary: true, act: () => (this.modal = null) });
    } else if (m.kind === "info") {
      out.push({ rect: { x: x + w / 2 - 80, y: by, w: 160, h: bh }, label: "Close", primary: true, act: () => (this.modal = null) });
    }
    return out;
  }

  private handleModalClick(px: number, py: number): void {
    const L = this.layout();
    for (const b of this.modalButtons(L)) {
      if (b.enabled === false) continue;
      if (pointInRect(px, py, b.rect)) { b.act(); return; }
    }
  }

  // ---------------- drawing ----------------
  draw(r: Renderer): void {
    const ctx = r.ctx;
    const L = this.layout();
    r.clear("#8ec5e8");

    // town art, clipped to its region and panned
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.region.x, L.region.y, L.region.w, L.region.h);
    ctx.clip();
    const tw = Math.round(DESIGN_W * L.scale), th = Math.round(DESIGN_H * L.scale);
    ctx.drawImage(townBackground(tw, th, this.state.town.faction), Math.round(L.offX), Math.round(L.offY));
    for (const id of this.order) this.drawBuilding(ctx, L, id);
    ctx.restore();

    // title banner
    const bannerW = Math.min(280, L.vw - 24);
    panel(ctx, L.vw / 2 - bannerW / 2, L.topH + 8, bannerW, 34, "#6b4a24", "#8a6432", "#3a2410");
    textShadow(ctx, this.state.town.name, L.vw / 2, L.topH + 31, "#fff0c8", "bold 20px 'Trebuchet MS'", "center");

    this.drawArmies(ctx, L);
    drawResourceBar(ctx, this.state, 0, 0, L.vw, L.topH);
    button(ctx, L.btnLeave, false);

    if (this.hover && !this.modal) this.drawTooltip(ctx, L, this.hover);
    if (this.modal) this.drawModal(ctx, L);
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, L: Layout, id: BuildingId): void {
    const art = buildingArt(id, this.state.town.faction);
    const rect = this.buildingRect(L, id);
    const built = this.state.town.built.has(id);
    if (!built) {
      ctx.globalAlpha = 0.28;
      ctx.drawImage(art, rect.x, rect.y, rect.w, rect.h);
      ctx.globalAlpha = 1;
      const can = canBuild(this.state, id).ok;
      const m = Math.min(rect.w, rect.h) * 0.32;
      panel(ctx, rect.x + rect.w / 2 - m / 2, rect.y + rect.h / 2 - m / 2, m, m, can ? "#4f8a3a" : "#7d3a3a", "#79b85a", "#1c1208");
      text(ctx, "+", rect.x + rect.w / 2, rect.y + rect.h / 2 + m * 0.3, "#fff0c8", `bold ${Math.round(m * 0.7)}px 'Trebuchet MS'`, "center");
    } else {
      ctx.drawImage(art, rect.x, rect.y, rect.w, rect.h);
      if (this.hover === id) {
        ctx.strokeStyle = "rgba(255,240,176,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      }
    }
  }

  private drawTooltip(ctx: CanvasRenderingContext2D, L: Layout, id: BuildingId): void {
    const b = this.buildings[id];
    const built = this.state.town.built.has(id);
    const lines = [b.name, built ? b.desc : `Cost: ${costStr(b.cost)}`];
    const w = 240;
    const x = Math.min(L.vw - w - 8, Math.max(8, this.app.input.pointer.x + 14));
    const y = Math.max(L.topH + 8, this.app.input.pointer.y - 60);
    parchment(ctx, x, y, w, 56);
    textShadow(ctx, lines[0], x + 12, y + 22, "#5b2a10", "bold 15px 'Trebuchet MS'");
    wrapText(ctx, lines[1], x + 12, y + 40, w - 24, 16, "#3a2410", "12px 'Trebuchet MS'");
  }

  // ---- army strips (garrison + hero) and troop transfer ----
  private armyFor(side: "hero" | "garrison"): Army {
    return side === "garrison" ? this.state.town.garrison : this.state.hero.army;
  }
  private garrisonRowY(L: Layout): number { return L.vh - L.armyH; }
  private heroRowY(L: Layout): number { return L.vh - L.rowH; }

  // Five evenly-spaced slot rects for a strip whose panel starts at rowY.
  private rowSlots(L: Layout, rowY: number): Rect[] {
    const cols = 5;
    const leaveLeft = L.btnLeave.x - 12;
    const avail = leaveLeft - 16;
    const slotW = Math.min(96, (avail - (cols - 1) * 8) / cols);
    const sy = rowY + 30;
    const out: Rect[] = [];
    for (let i = 0; i < cols; i++) {
      const sx = 16 + i * (slotW + 8);
      if (sx + slotW > leaveLeft) break;
      out.push({ x: sx, y: sy, w: slotW, h: L.rowH - 40 });
    }
    return out;
  }

  private drawArmies(ctx: CanvasRenderingContext2D, L: Layout): void {
    this.drawStrip(ctx, L, "garrison", this.garrisonRowY(L));
    if (this.heroHere) this.drawStrip(ctx, L, "hero", this.heroRowY(L));
    if (this.state.town.builtToday) {
      text(ctx, "Built today", L.btnLeave.x - 4, this.heroRowY(L) + 22, "#e8a0a0", "12px 'Trebuchet MS'", "right");
    }
  }

  private drawStrip(ctx: CanvasRenderingContext2D, L: Layout, side: "hero" | "garrison", rowY: number): void {
    panel(ctx, 0, rowY, L.vw, L.rowH);
    const label = side === "garrison" ? "Garrison" : "Hero's Army";
    text(ctx, label, 16, rowY + 22, "#fff0c8", "bold 14px 'Trebuchet MS'");
    if (side === "garrison" && this.heroHere) {
      text(ctx, "tap a stack, then a slot in the other row to move it",
        140, rowY + 22, "#b7a884", "11px 'Trebuchet MS'");
    }
    if (side === "hero") {
      const bx = 140, bw = Math.min(220, L.btnLeave.x - bx - 12);
      if (bw > 80) heroBadge(ctx, this.state.hero, bx, rowY + 18, bw, { dark: true, bar: false });
    }
    const army = this.armyFor(side);
    const slots = this.rowSlots(L, rowY);
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i];
      panel(ctx, sl.x, sl.y, sl.w, sl.h, "#5b4a36", "#6a5a44", "#2a1d10");
      const s = army[i];
      if (s && s.count > 0) {
        const spr = creatureSprite(s.id);
        spr.drawCenteredBottom(ctx, sl.x + 22, sl.y + sl.h - 6, 2);
        text(ctx, CREATURES[s.id].name, sl.x + 38, sl.y + 16, "#fff0c8", "10px 'Trebuchet MS'");
        text(ctx, `x${s.count}`, sl.x + 38, sl.y + 32, "#f2c44d", "bold 13px 'Trebuchet MS'");
      }
      if (this.selected && this.selected.side === side && this.selected.idx === i) {
        ctx.strokeStyle = "#f2c44d";
        ctx.lineWidth = 3;
        ctx.strokeRect(sl.x + 1, sl.y + 1, sl.w - 2, sl.h - 2);
      }
    }
  }

  // Returns true if the tap hit an army slot (and was handled).
  private handleArmyClick(L: Layout, px: number, py: number): boolean {
    const rows: { side: "hero" | "garrison"; rowY: number }[] = [
      { side: "garrison", rowY: this.garrisonRowY(L) },
    ];
    if (this.heroHere) rows.push({ side: "hero", rowY: this.heroRowY(L) });
    for (const row of rows) {
      const slots = this.rowSlots(L, row.rowY);
      for (let i = 0; i < slots.length; i++) {
        if (pointInRect(px, py, slots[i])) { this.onSlotTap(row.side, i); return true; }
      }
    }
    return false;
  }

  private onSlotTap(side: "hero" | "garrison", idx: number): void {
    // Transfers need a hero present (two armies to move between).
    if (!this.heroHere) { this.selected = null; return; }
    const sel = this.selected;
    if (sel && sel.side !== side) {
      const from = this.armyFor(sel.side);
      const moving = from[sel.idx];
      if (moving) { transferStack(from, sel.idx, this.armyFor(side), moving.count); this.app.save(); }
      this.selected = null;
      return;
    }
    if (sel && sel.side === side && sel.idx === idx) { this.selected = null; return; }
    const s = this.armyFor(side)[idx];
    this.selected = s && s.count > 0 ? { side, idx } : null;
  }

  // ---- modals ----
  private drawModal(ctx: CanvasRenderingContext2D, L: Layout): void {
    const m = this.modal!;
    const box = this.modalBox(L);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, L.vw, L.vh);
    parchment(ctx, box.x, box.y, box.w, box.h);

    if (m.kind === "build") this.drawBuildModal(ctx, box, m.id);
    else if (m.kind === "recruit") this.drawRecruitModal(ctx, box, m);
    else if (m.kind === "market") this.drawMarketModal(ctx, box);
    else if (m.kind === "info") {
      textShadow(ctx, m.title, box.x + box.w / 2, box.y + 40, "#5b2a10", "bold 22px 'Trebuchet MS'", "center");
      wrapText(ctx, m.body, box.x + 24, box.y + 78, box.w - 48, 24, "#3a2410", "16px 'Trebuchet MS'");
    }
    for (const b of this.modalButtons(L)) button(ctx, { ...b.rect, label: b.label, enabled: b.enabled, primary: b.primary }, false);
  }

  private drawBuildModal(ctx: CanvasRenderingContext2D, box: Rect, id: BuildingId): void {
    const b = this.buildings[id];
    const { x, y, w } = box;
    ctx.drawImage(buildingArt(id, this.state.town.faction), x + 20, y + 20, 96, 96);
    textShadow(ctx, b.name, x + 128, y + 44, "#5b2a10", "bold 21px 'Trebuchet MS'");
    wrapText(ctx, b.desc, x + 128, y + 70, w - 148, 20, "#3a2410", "14px 'Trebuchet MS'");
    text(ctx, "Cost:", x + 24, y + 150, "#5b3a1a", "bold 14px 'Trebuchet MS'");
    this.drawCostRow(ctx, b.cost, x + 74, y + 142);
    const reason = canBuild(this.state, id).reason;
    if (reason) text(ctx, reason, x + 24, y + 178, "#9c3a2a", "13px 'Trebuchet MS'");
  }

  private drawRecruitModal(ctx: CanvasRenderingContext2D, box: Rect, m: { cid: CreatureId; qty: number }): void {
    const c = CREATURES[m.cid];
    const { x, y } = box;
    const spr = creatureSprite(m.cid);
    parchment(ctx, x + 20, y + 20, 92, 92);
    spr.drawCenteredBottom(ctx, x + 66, y + 104, 4);
    textShadow(ctx, c.name, x + 124, y + 42, "#5b2a10", "bold 21px 'Trebuchet MS'");
    text(ctx, `Atk ${c.atk}  Def ${c.def}  HP ${c.hp}`, x + 124, y + 66, "#3a2410", "13px 'Trebuchet MS'");
    text(ctx, `Dmg ${c.dmgMin}-${c.dmgMax}  Spd ${c.speed}${c.shots ? "  Shots " + c.shots : ""}`, x + 124, y + 86, "#3a2410", "13px 'Trebuchet MS'");
    const avail = this.state.town.available[m.cid] ?? 0;
    text(ctx, `Available: ${avail}`, x + 124, y + 108, "#5b3a1a", "bold 13px 'Trebuchet MS'");
    // quantity readout between - and + (buttons drawn separately)
    const qy = box.y + box.h - 124;
    panel(ctx, x + 70, qy, 46, 44, "#d8c089", "#ece0b8", "#9c7c44");
    text(ctx, String(m.qty), x + 93, qy + 30, "#3a2410", "bold 20px 'Trebuchet MS'", "center");
    text(ctx, "Total:", x + 252, qy + 18, "#5b3a1a", "bold 13px 'Trebuchet MS'");
    this.drawCostRow(ctx, scaleCost(c.cost, m.qty), x + 252, qy + 26);
  }

  private drawMarketModal(ctx: CanvasRenderingContext2D, box: Rect): void {
    const { x, y } = box;
    textShadow(ctx, "Marketplace", box.x + box.w / 2, y + 38, "#5b2a10", "bold 22px 'Trebuchet MS'", "center");
    RESOURCE_ORDER.filter((k) => k !== "gold").forEach((k, i) => {
      const ry = y + 70 + i * 38;
      ctx.drawImage(resourceIcon(k), x + 24, ry - 16);
      text(ctx, RESOURCE_LABEL[k], x + 50, ry, "#3a2410", "14px 'Trebuchet MS'");
      text(ctx, `Have ${this.state.resources[k]}`, x + 140, ry, "#5b3a1a", "13px 'Trebuchet MS'");
      text(ctx, `${SELL_RATE[k]}g`, x + 250, ry, "#a8761f", "13px 'Trebuchet MS'");
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
