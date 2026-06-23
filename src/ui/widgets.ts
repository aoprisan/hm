// Shared immediate-mode UI helpers: ornate panels, buttons and text.
export interface Rect { x: number; y: number; w: number; h: number; }

export interface Button extends Rect {
  label: string;
  enabled?: boolean;
  tag?: string;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;
}

// Carved stone/wood panel with a beveled border.
export function panel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill = "#6b4a24", light = "#8a6432", dark = "#3a2410",
): void {
  ctx.fillStyle = dark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = light;
  ctx.fillRect(x + 3, y + 3, w - 6, 2);
  ctx.fillStyle = light;
  ctx.fillRect(x + 3, y + 3, 2, h - 6);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 3, y + h - 5, w - 6, 2);
  ctx.fillRect(x + w - 5, y + 3, 2, h - 6);
}

export function parchment(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  panel(ctx, x, y, w, h, "#d8c089", "#ece0b8", "#9c7c44");
  ctx.fillStyle = "#e8d6a4";
  ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
}

export function button(
  ctx: CanvasRenderingContext2D, b: Button, hover: boolean,
): void {
  const enabled = b.enabled !== false;
  const base = !enabled ? "#5a4a36" : hover ? "#a9803c" : "#8a6432";
  const light = !enabled ? "#6a5a44" : "#cda159";
  const dark = "#3a2410";
  ctx.fillStyle = dark;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = base;
  ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  ctx.fillStyle = light;
  ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 2);
  ctx.fillStyle = dark;
  ctx.fillRect(b.x + 2, b.y + b.h - 4, b.w - 4, 2);
  ctx.fillStyle = enabled ? "#fff0c8" : "#9c8c70";
  ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.textAlign = "left";
}

export function text(
  ctx: CanvasRenderingContext2D, str: string, x: number, y: number,
  color = "#f2e4c0", font = "14px 'Trebuchet MS', sans-serif", align: CanvasTextAlign = "left",
): void {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(str, x, y);
  ctx.textAlign = "left";
}

export function textShadow(
  ctx: CanvasRenderingContext2D, str: string, x: number, y: number,
  color = "#f2e4c0", font = "14px 'Trebuchet MS', sans-serif", align: CanvasTextAlign = "left",
): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.textAlign = "left";
}

// Word-wrap helper.
export function wrapText(
  ctx: CanvasRenderingContext2D, str: string, x: number, y: number, maxW: number, lineH: number,
  color = "#3a2410", font = "14px 'Trebuchet MS', sans-serif",
): number {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "left";
  const words = str.split(" ");
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy + lineH;
}
