// Renderer: a responsive, mobile-first virtual canvas. The virtual coordinate
// space equals the CSS viewport size (so 1 virtual px == 1 CSS px and UI sizes
// stay physically consistent across devices), while the backing store is scaled
// by the device pixel ratio for crisp text. Scenes lay out against the live
// `vw`/`vh`/`portrait` fields rather than fixed constants.

// Baseline design dimensions, kept only for code that wants a reference ratio.
export const DESIGN_W = 1024;
export const DESIGN_H = 640;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  vw = DESIGN_W; // virtual (== CSS) width
  vh = DESIGN_H; // virtual (== CSS) height
  dpr = 1; // backing-store scale for crisp rendering
  portrait = false;
  onResize: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => this.resize());
    // The mobile URL bar shows/hides; visualViewport tracks the usable area.
    window.visualViewport?.addEventListener("resize", () => this.resize());
  }

  private viewportSize(): { w: number; h: number } {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    return { w: Math.max(320, w), h: Math.max(360, h) };
  }

  resize(): void {
    const { w, h } = this.viewportSize();
    // Cap DPR for fill-rate on dense phones; 2x is plenty for pixel art + text.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = w;
    this.vh = h;
    this.portrait = h >= w;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.applyBaseTransform();
    this.onResize?.();
  }

  // Drawing happens in virtual (CSS) units; the base transform bakes in the DPR.
  private applyBaseTransform(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  // Client (mouse/touch) coordinate -> virtual coordinate. Since the canvas CSS
  // size equals the virtual size, this is just the offset from the canvas rect.
  toVirtual(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  clear(color = "#0c0a06"): void {
    this.applyBaseTransform();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.vw, this.vh);
  }
}
