// Renderer: fixed virtual resolution scaled to fit the window with crisp pixels.
// All drawing happens in "virtual" pixels; CSS scales the canvas up.

export const VW = 1024; // virtual width
export const VH = 640; // virtual height

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  scale = 1; // css pixels per virtual pixel
  offsetX = 0; // css offset of canvas top-left within client
  offsetY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = VW;
    canvas.height = VH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize(): void {
    // Smaller breathing room on phone-sized viewports so the map isn't tiny.
    const margin = Math.min(window.innerWidth, window.innerHeight) < 600 ? 4 : 24;
    const availW = window.innerWidth - margin;
    const availH = window.innerHeight - margin;
    // Prefer integer scaling for the crispest pixels; fall back to fractional.
    let s = Math.min(availW / VW, availH / VH);
    if (s >= 1) s = Math.max(1, Math.floor(s));
    s = Math.max(0.4, s);
    this.scale = s;
    const cssW = Math.round(VW * s);
    const cssH = Math.round(VH * s);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    const rect = this.canvas.getBoundingClientRect();
    this.offsetX = rect.left;
    this.offsetY = rect.top;
  }

  // Convert a client (mouse/touch) coordinate into a virtual coordinate.
  // Derive the scale from the canvas's actual rendered size rather than the
  // stored `scale`: CSS `max-width/height: 100%` can shrink the canvas below
  // the requested size on small/portrait screens, and using the real rect
  // keeps taps aligned in that case.
  toVirtual(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? VW / rect.width : 1;
    const sy = rect.height > 0 ? VH / rect.height : 1;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  clear(color = "#0c0a06"): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, VW, VH);
  }
}
