// Title / faction-select scene. Shows the four castle types as cards; the player
// taps one to select it and presses Start to begin a new game with that faction.
// Built entirely from the shared immediate-mode widgets.
import type { App } from "../app";
import { Scene } from "../engine/scene";
import { Renderer } from "../engine/renderer";
import { Input } from "../engine/input";
import { Sfx } from "../engine/audio";
import { FactionId, FACTIONS, FACTION_ORDER } from "../data/factions";
import { creatureSprite } from "../art/sprites_creatures";
import { castleSprite } from "../art/sprites_objects";
import {
  Button, button, glass, panel, parchment, pointInRect, text, textShadow, wrapText, Rect,
} from "../ui/widgets";
import { qrMatrix } from "../util/qrcode";
import { shareUrl, genericShare } from "../util/share";
import { listSaves, deleteSlot, type SlotMeta } from "../game/persist";

interface Layout {
  vw: number; vh: number;
  cols: number;
  cards: { id: FactionId; rect: Rect }[];
  start: Button;
  cont?: Button; // "Continue Quest" — only when a saved run exists
  load?: Button; // "Load Game" — opens the saved-run list
  btnShare: Button;
  btnQr: Button;
}

// Geometry of the QR invite overlay, computed from the live layout.
interface QrLayout { x: number; y: number; w: number; h: number; close: Rect; share: Button; }

// Geometry of the load-game overlay: the panel, its clipped list viewport, the
// close button, and one row (with a delete hit-box) per visible save.
interface LoadRow { meta: SlotMeta; rect: Rect; del: Rect; }
interface LoadLayout {
  x: number; y: number; w: number; h: number;
  close: Rect; view: Rect; rowH: number; contentH: number; rows: LoadRow[];
}

export class MenuScene implements Scene {
  private selected: FactionId = "knight";
  private qrOpen = false;
  private qrCache: boolean[][] | null = null;
  private toast: { msg: string; t: number } | null = null;
  // Load-game overlay state: open flag, the saves snapshot it lists, and the
  // vertical scroll offset (clamped to the content in loadLayout).
  private loadOpen = false;
  private loadSlots: SlotMeta[] = [];
  private loadScroll = 0;

  constructor(private app: App) { this.loadSlots = listSaves(); }
  private get r(): Renderer { return this.app.renderer; }

  private layout(): Layout {
    const r = this.r;
    const vw = r.vw, vh = r.vh;
    const pad = 16;
    const titleH = Math.round(Math.min(120, Math.max(72, vh * 0.16)));
    const startH = 56;
    const btnGap = 10;
    const save = this.loadSlots.length > 0;
    // With saves present the bottom stack is three buttons (New Quest, Load
    // Game, Continue Quest); otherwise just Start Quest.
    const nBottom = save ? 3 : 1;
    const gridTop = titleH;
    const gridBottom = vh - startH * nBottom - btnGap * (nBottom - 1) - pad * 2;
    const cols = vw >= 760 ? 4 : 2;
    const rows = Math.ceil(FACTION_ORDER.length / cols);
    const cellW = (vw - pad * (cols + 1)) / cols;
    const cellH = (gridBottom - gridTop - pad * (rows - 1)) / rows;
    const cards = FACTION_ORDER.map((id, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      return {
        id,
        rect: {
          x: pad + col * (cellW + pad),
          y: gridTop + row * (cellH + pad),
          w: cellW, h: cellH,
        } as Rect,
      };
    });
    const startW = Math.min(280, vw - pad * 2);
    const startX = (vw - startW) / 2;
    // With saved runs, Continue is the primary CTA at the bottom, Load Game sits
    // above it and New Quest above that; otherwise a single Start Quest button.
    let start: Button;
    let cont: Button | undefined;
    let load: Button | undefined;
    if (save) {
      cont = { x: startX, y: vh - startH - pad, w: startW, h: startH, label: "Continue Quest", primary: true };
      load = { x: startX, y: vh - startH * 2 - btnGap - pad, w: startW, h: startH, label: "Load Game" };
      start = { x: startX, y: vh - startH * 3 - btnGap * 2 - pad, w: startW, h: startH, label: "New Quest" };
    } else {
      start = { x: startX, y: vh - startH - pad, w: startW, h: startH, label: "Start Quest", primary: true };
    }
    // Compact invite icons in the top-right corner (share sheet + QR code).
    const ib = 40, ig = 8;
    const btnShare: Button = { x: vw - pad - ib, y: pad, w: ib, h: ib, label: "⤴" };
    const btnQr: Button = { x: vw - pad - ib * 2 - ig, y: pad, w: ib, h: ib, label: "QR" };
    return { vw, vh, cols, cards, start, cont, load, btnShare, btnQr };
  }

  // Overlay geometry for the load-game list: a parchment panel with a clipped,
  // scrollable column of save rows. Each row carries a delete hit-box on its
  // right edge; the rest of the row loads that save.
  private loadLayout(L: Layout): LoadLayout {
    const w = Math.min(420, L.vw - 24);
    const h = Math.min(L.vh - 24, 560);
    const x = (L.vw - w) / 2, y = (L.vh - h) / 2;
    const close: Rect = { x: x + w - 42, y: y + 10, w: 32, h: 32 };
    const view: Rect = { x: x + 14, y: y + 54, w: w - 28, h: h - 54 - 14 };
    const rowH = 72, rowGap = 8;
    const contentH = this.loadSlots.length * (rowH + rowGap);
    const maxScroll = Math.max(0, contentH - view.h);
    this.loadScroll = Math.max(0, Math.min(this.loadScroll, maxScroll));
    const rows: LoadRow[] = this.loadSlots.map((meta, i) => {
      const ry = view.y + i * (rowH + rowGap) - this.loadScroll;
      const rect: Rect = { x: view.x, y: ry, w: view.w, h: rowH };
      const del: Rect = { x: view.x + view.w - 46, y: ry + (rowH - 40) / 2, w: 40, h: 40 };
      return { meta, rect, del };
    });
    return { x, y, w, h, close, view, rowH, contentH, rows };
  }

  // Overlay geometry: a parchment panel holding the QR, the URL and a share button.
  private qrLayout(L: Layout): QrLayout {
    const w = Math.min(360, L.vw - 32);
    const h = Math.min(L.vh - 32, w + 130);
    const x = (L.vw - w) / 2, y = (L.vh - h) / 2;
    const close: Rect = { x: x + w - 42, y: y + 10, w: 32, h: 32 };
    const share: Button = { x: x + 24, y: y + h - 60, w: w - 48, h: 44, label: "Share link", primary: true };
    return { x, y, w, h, close, share };
  }

  update(dt: number, input: Input): void {
    // Keep the saved-run snapshot fresh so the bottom buttons (and the list)
    // reflect saves made or deleted since the menu was last shown.
    if (!this.loadOpen) this.loadSlots = listSaves();
    const L = this.layout();
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    // Drag to scroll the open load list.
    if (this.loadOpen) { this.loadScroll -= input.takePan().dy; }
    for (const c of input.takeClicks()) {
      Sfx.click();
      if (this.loadOpen) { this.handleLoadClick(c, L); continue; }
      if (this.qrOpen) {
        const q = this.qrLayout(L);
        if (pointInRect(c.x, c.y, q.share)) { this.doShare(); continue; }
        // Close on the ✕ or anywhere outside the panel.
        const insidePanel = c.x >= q.x && c.x <= q.x + q.w && c.y >= q.y && c.y <= q.y + q.h;
        if (pointInRect(c.x, c.y, q.close) || !insidePanel) this.qrOpen = false;
        continue;
      }
      if (pointInRect(c.x, c.y, L.btnQr)) { this.openQr(); continue; }
      if (pointInRect(c.x, c.y, L.btnShare)) { this.doShare(); continue; }
      if (L.cont && pointInRect(c.x, c.y, L.cont)) { this.app.continueGame(); return; }
      if (L.load && pointInRect(c.x, c.y, L.load)) { this.openLoad(); continue; }
      if (pointInRect(c.x, c.y, L.start)) { this.app.newGame(this.selected); return; }
      for (const card of L.cards) {
        if (pointInRect(c.x, c.y, card.rect)) { this.selected = card.id; break; }
      }
    }
    for (const k of input.takeKeys()) {
      if (this.loadOpen) { if (k === "Escape") this.loadOpen = false; continue; }
      if (this.qrOpen) { if (k === "Escape" || k === "Enter" || k === " ") this.qrOpen = false; continue; }
      if (k === "Enter" || k === " ") { this.app.newGame(this.selected); return; }
      if (k === "ArrowRight" || k === "ArrowDown") this.step(1);
      if (k === "ArrowLeft" || k === "ArrowUp") this.step(-1);
    }
  }

  private openQr(): void {
    this.qrCache ??= qrMatrix(shareUrl());
    this.qrOpen = true;
  }

  private openLoad(): void {
    this.loadSlots = listSaves();
    this.loadScroll = 0;
    this.loadOpen = true;
  }

  // A tap inside the load overlay: load a row, delete a row (with confirm), or
  // dismiss via the ✕ / tapping outside the panel.
  private handleLoadClick(c: { x: number; y: number }, L: Layout): void {
    const ll = this.loadLayout(L);
    if (pointInRect(c.x, c.y, ll.close)) { this.loadOpen = false; return; }
    const insidePanel = c.x >= ll.x && c.x <= ll.x + ll.w && c.y >= ll.y && c.y <= ll.y + ll.h;
    if (!insidePanel) { this.loadOpen = false; return; }
    // Ignore taps that fall outside the clipped list viewport (e.g. the header).
    if (!pointInRect(c.x, c.y, ll.view)) return;
    for (const row of ll.rows) {
      if (!pointInRect(c.x, c.y, row.rect)) continue;
      if (pointInRect(c.x, c.y, row.del)) {
        const ok = typeof window === "undefined" || !window.confirm
          ? true
          : window.confirm(`Delete "${row.meta.name}"? This cannot be undone.`);
        if (ok) {
          deleteSlot(row.meta.id);
          this.loadSlots = listSaves();
          if (this.loadSlots.length === 0) this.loadOpen = false;
        }
        return;
      }
      this.app.loadGame(row.meta.id);
      return;
    }
  }

  private doShare(): void {
    void genericShare().then((result) => {
      if (result === "copied") this.toast = { msg: "Link copied!", t: 1.8 };
      else if (result === "unavailable") this.toast = { msg: shareUrl(), t: 3.5 };
    });
  }

  private step(dir: number): void {
    const i = FACTION_ORDER.indexOf(this.selected);
    this.selected = FACTION_ORDER[(i + dir + FACTION_ORDER.length) % FACTION_ORDER.length];
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    const L = this.layout();
    // backdrop
    const g = ctx.createLinearGradient(0, 0, 0, L.vh);
    g.addColorStop(0, "#241a2e");
    g.addColorStop(1, "#0e0a14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.vw, L.vh);

    // title
    const titleSize = Math.round(Math.min(48, L.vw * 0.07));
    textShadow(ctx, "Realms of Valor", L.vw / 2, Math.round(L.vh * 0.07) + titleSize / 2,
      "#f2e4a0", `bold ${titleSize}px 'Trebuchet MS'`, "center");
    text(ctx, "Choose your castle", L.vw / 2, Math.round(L.vh * 0.07) + titleSize + 14,
      "#cdbb90", "15px 'Trebuchet MS'", "center");

    for (const card of L.cards) this.drawCard(ctx, card.id, card.rect);

    button(ctx, L.start, false);
    if (L.cont) button(ctx, L.cont, false);
    if (L.load) button(ctx, L.load, false);
    button(ctx, L.btnQr, false);
    button(ctx, L.btnShare, false);

    if (this.qrOpen) this.drawQr(ctx, L);
    if (this.loadOpen) this.drawLoad(ctx, L);
    if (this.toast) this.drawToast(ctx, L);
  }

  private drawLoad(ctx: CanvasRenderingContext2D, L: Layout): void {
    const ll = this.loadLayout(L);
    // dim the screen behind the panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, L.vw, L.vh);
    parchment(ctx, ll.x, ll.y, ll.w, ll.h);
    textShadow(ctx, "Load Game", ll.x + ll.w / 2, ll.y + 36, "#5b2a10", "bold 20px 'Trebuchet MS'", "center");
    button(ctx, { ...ll.close, label: "✕" }, false);

    // Clip rows to the viewport so scrolled content doesn't bleed over the title.
    ctx.save();
    ctx.beginPath();
    ctx.rect(ll.view.x, ll.view.y, ll.view.w, ll.view.h);
    ctx.clip();
    for (const row of ll.rows) {
      if (row.rect.y + row.rect.h < ll.view.y || row.rect.y > ll.view.y + ll.view.h) continue;
      this.drawSlotRow(ctx, row);
    }
    ctx.restore();

    // A subtle scrollbar hint when the list overflows.
    if (ll.contentH > ll.view.h) {
      const trackH = ll.view.h;
      const thumbH = Math.max(24, trackH * (ll.view.h / ll.contentH));
      const maxScroll = ll.contentH - ll.view.h;
      const t = maxScroll > 0 ? this.loadScroll / maxScroll : 0;
      const thumbY = ll.view.y + t * (trackH - thumbH);
      ctx.fillStyle = "rgba(91,42,16,0.45)";
      ctx.fillRect(ll.x + ll.w - 8, thumbY, 4, thumbH);
    }
  }

  private drawSlotRow(ctx: CanvasRenderingContext2D, row: LoadRow): void {
    const { rect, del, meta } = row;
    panel(ctx, rect.x, rect.y, rect.w, rect.h, "#caa86a", "#e4d09a", "#8a6a36");
    const pad = 12;
    text(ctx, meta.name, rect.x + pad, rect.y + 26, "#3a2410", "bold 17px 'Trebuchet MS'");
    const phaseTag = meta.phase === "cleared" ? " • ready to advance" : "";
    const sub = `${meta.realm} — Day ${meta.day}${phaseTag}`;
    text(ctx, sub, rect.x + pad, rect.y + 47, "#5b3a1a", "13px 'Trebuchet MS'");
    text(ctx, `${meta.heroName} · ${this.timeAgo(meta.savedAt)}`, rect.x + pad, rect.y + 64,
      "#6b4a24", "12px 'Trebuchet MS'");
    // delete affordance
    button(ctx, { ...del, label: "🗑" }, false);
  }

  // Compact "saved X ago" relative time for the slot list.
  private timeAgo(ts: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  private drawQr(ctx: CanvasRenderingContext2D, L: Layout): void {
    const q = this.qrLayout(L);
    // dim the screen behind the panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, L.vw, L.vh);
    parchment(ctx, q.x, q.y, q.w, q.h);
    textShadow(ctx, "Invite a friend", q.x + q.w / 2, q.y + 36, "#5b2a10", "bold 20px 'Trebuchet MS'", "center");

    // QR area: a white quiet-zone with black modules, centered horizontally.
    const m = this.qrCache!;
    const areaW = q.w - 48;
    const areaTop = q.y + 52;
    const areaBottom = q.share.y - 34; // leave room for the URL line below the code
    const area = Math.max(80, Math.min(areaW, areaBottom - areaTop));
    const cell = Math.max(1, Math.floor(area / (m.length + 8))); // +8 for a 4-module quiet zone
    const dim = cell * (m.length + 8);
    const ox = Math.round(q.x + q.w / 2 - dim / 2);
    const oy = Math.round(areaTop + (area - dim) / 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(ox, oy, dim, dim);
    ctx.fillStyle = "#000000";
    const off = cell * 4; // quiet-zone margin
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m.length; x++) {
        if (m[y][x]) ctx.fillRect(ox + off + x * cell, oy + off + y * cell, cell, cell);
      }
    }

    // URL under the code
    text(ctx, shareUrl(), q.x + q.w / 2, q.share.y - 12, "#5b3a1a", "12px 'Trebuchet MS'", "center");

    button(ctx, q.share, false);
    button(ctx, { ...q.close, label: "✕" }, false);
  }

  private drawToast(ctx: CanvasRenderingContext2D, L: Layout): void {
    const msg = this.toast!.msg;
    ctx.font = "13px 'Trebuchet MS'";
    const w = Math.min(L.vw - 32, ctx.measureText(msg).width + 32);
    const h = 32;
    const x = (L.vw - w) / 2;
    const y = L.start.y - h - 14;
    glass(ctx, x, y, w, h, 8, 0.8);
    text(ctx, msg, L.vw / 2, y + h / 2 + 4, "#fff0c8", "13px 'Trebuchet MS'", "center");
  }

  private drawCard(ctx: CanvasRenderingContext2D, id: FactionId, rect: Rect): void {
    const f = FACTIONS[id];
    const selected = id === this.selected;
    parchment(ctx, rect.x, rect.y, rect.w, rect.h);

    const cx = rect.x + rect.w / 2;
    // castle preview
    const castle = castleSprite("player", id);
    const cScale = Math.min(1.3, (rect.w * 0.45) / castle.width, (rect.h * 0.34) / castle.height);
    const cw = castle.width * cScale, chh = castle.height * cScale;
    ctx.drawImage(castle, Math.round(cx - cw / 2), Math.round(rect.y + 12), Math.round(cw), Math.round(chh));

    // type label + faction name
    textShadow(ctx, f.name, cx, rect.y + chh + 38, "#5b2a10", "bold 20px 'Trebuchet MS'", "center");

    // creature previews (tier 1 and tier 6) on a banner row
    const rowY = rect.y + chh + 86;
    const t1 = creatureSprite(f.lineup[0]);
    const t6 = creatureSprite(f.lineup[5]);
    const sprScale = Math.max(2, Math.min(3, Math.floor((rect.w * 0.3) / t6.w)));
    t1.drawCenteredBottom(ctx, cx - rect.w * 0.18, rowY, sprScale);
    t6.drawCenteredBottom(ctx, cx + rect.w * 0.18, rowY, sprScale);

    // blurb
    wrapText(ctx, f.blurb, rect.x + 14, rowY + 22, rect.w - 28, 17, "#3a2410", "12px 'Trebuchet MS'");

    if (selected) {
      ctx.strokeStyle = "#f2c44d";
      ctx.lineWidth = 4;
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    }
  }
}
