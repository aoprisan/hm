// PixelSprite: bake an array of character rows into an offscreen canvas once,
// then blit it (optionally scaled) wherever needed. This is the single visual
// primitive used by every tile, creature, building and UI element.
import { PAL } from "./palette";

export class PixelSprite {
  readonly canvas: HTMLCanvasElement;
  readonly w: number;
  readonly h: number;

  constructor(rows: string[], palette: Record<string, string | null> = PAL) {
    this.h = rows.length;
    this.w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const cv = document.createElement("canvas");
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] ?? ".";
        const hex = palette[ch];
        if (hex == null) continue; // transparent
        const i = (y * this.w + x) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.canvas = cv;
  }

  // Draw at integer scale (nearest-neighbor). dx/dy are top-left in target px.
  draw(ctx: CanvasRenderingContext2D, dx: number, dy: number, scale = 1): void {
    ctx.drawImage(this.canvas, 0, 0, this.w, this.h, dx, dy, this.w * scale, this.h * scale);
  }

  // Draw centered horizontally within [dx, dx+width], bottom-aligned at dy+height.
  drawCenteredBottom(
    ctx: CanvasRenderingContext2D,
    cx: number,
    bottomY: number,
    scale = 1,
  ): void {
    const w = this.w * scale;
    const h = this.h * scale;
    ctx.drawImage(this.canvas, 0, 0, this.w, this.h, Math.round(cx - w / 2), Math.round(bottomY - h), w, h);
  }

  // Mirror-draw (faces the other way), integer scale.
  drawFlipped(ctx: CanvasRenderingContext2D, dx: number, dy: number, scale = 1): void {
    ctx.save();
    ctx.translate(dx + this.w * scale, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(this.canvas, 0, 0, this.w, this.h, 0, 0, this.w * scale, this.h * scale);
    ctx.restore();
  }
}

// Helper for procedurally-tinted variants without rewriting char rows.
export function makePalette(overrides: Record<string, string | null>): Record<string, string | null> {
  return { ...PAL, ...overrides };
}
