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
  Button, button, parchment, pointInRect, text, textShadow, wrapText, Rect,
} from "../ui/widgets";

interface Layout {
  vw: number; vh: number;
  cols: number;
  cards: { id: FactionId; rect: Rect }[];
  start: Button;
}

export class MenuScene implements Scene {
  private selected: FactionId = "knight";

  constructor(private app: App) {}
  private get r(): Renderer { return this.app.renderer; }

  private layout(): Layout {
    const r = this.r;
    const vw = r.vw, vh = r.vh;
    const pad = 16;
    const titleH = Math.round(Math.min(120, Math.max(72, vh * 0.16)));
    const startH = 56;
    const gridTop = titleH;
    const gridBottom = vh - startH - pad * 2;
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
    const start: Button = {
      x: (vw - startW) / 2, y: vh - startH - pad, w: startW, h: startH,
      label: "Start Quest", primary: true,
    };
    return { vw, vh, cols, cards, start };
  }

  update(_dt: number, input: Input): void {
    const L = this.layout();
    for (const c of input.takeClicks()) {
      Sfx.click();
      if (pointInRect(c.x, c.y, L.start)) { this.app.newGame(this.selected); return; }
      for (const card of L.cards) {
        if (pointInRect(c.x, c.y, card.rect)) { this.selected = card.id; break; }
      }
    }
    for (const k of input.takeKeys()) {
      if (k === "Enter" || k === " ") { this.app.newGame(this.selected); return; }
      if (k === "ArrowRight" || k === "ArrowDown") this.step(1);
      if (k === "ArrowLeft" || k === "ArrowUp") this.step(-1);
    }
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
