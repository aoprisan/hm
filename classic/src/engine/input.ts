// Input: unified mouse + touch with tap-vs-drag detection. A press that moves
// past a small threshold becomes a drag (emitting pan deltas) and does NOT emit
// a tap on release; a press that stays put emits a tap (left-click) on release.
// Also tracks the hover pointer (in virtual coords) and queued keys.
import { Renderer } from "./renderer";

export interface PointerState {
  x: number; // virtual coords
  y: number;
  down: boolean;
}

const TAP_SLOP = 12; // px of movement tolerated before a press becomes a drag

export class Input {
  readonly pointer: PointerState = { x: 0, y: 0, down: false };
  private clickQueue: { x: number; y: number; button: number }[] = [];
  private keysDown = new Set<string>();
  private keyQueue: string[] = [];

  // drag tracking
  private pressX = 0;
  private pressY = 0;
  private lastX = 0;
  private lastY = 0;
  private moved = 0;
  private dragging = false;
  private panDX = 0; // accumulated pan since last drained, in virtual px
  private panDY = 0;

  constructor(renderer: Renderer) {
    const canvas = renderer.canvas;

    // ---- mouse ----
    canvas.addEventListener("mousemove", (e) => {
      const v = renderer.toVirtual(e.clientX, e.clientY);
      this.pointer.x = v.x;
      this.pointer.y = v.y;
      if (this.pointer.down) this.trackMove(v.x, v.y);
    });
    canvas.addEventListener("mousedown", (e) => {
      const v = renderer.toVirtual(e.clientX, e.clientY);
      this.beginPress(v.x, v.y);
    });
    window.addEventListener("mouseup", (e) => {
      const v = renderer.toVirtual(e.clientX, e.clientY);
      this.endPress(v.x, v.y, e.button);
    });
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const v = renderer.toVirtual(e.clientX, e.clientY);
      this.clickQueue.push({ x: v.x, y: v.y, button: 2 });
    });

    // ---- touch ----
    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length) {
          const v = renderer.toVirtual(e.touches[0].clientX, e.touches[0].clientY);
          this.pointer.x = v.x;
          this.pointer.y = v.y;
          this.beginPress(v.x, v.y);
        }
        e.preventDefault();
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length) {
          const v = renderer.toVirtual(e.touches[0].clientX, e.touches[0].clientY);
          this.pointer.x = v.x;
          this.pointer.y = v.y;
          this.trackMove(v.x, v.y);
        }
        e.preventDefault();
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches[0];
        if (t) {
          const v = renderer.toVirtual(t.clientX, t.clientY);
          this.endPress(v.x, v.y, 0);
        } else {
          this.endPress(this.pointer.x, this.pointer.y, 0);
        }
        e.preventDefault();
      },
      { passive: false },
    );
    canvas.addEventListener("touchcancel", () => {
      this.pointer.down = false;
      this.dragging = false;
    });

    // ---- keys ----
    window.addEventListener("keydown", (e) => {
      if (!this.keysDown.has(e.key)) this.keyQueue.push(e.key);
      this.keysDown.add(e.key);
    });
    window.addEventListener("keyup", (e) => this.keysDown.delete(e.key));
  }

  private beginPress(x: number, y: number): void {
    this.pointer.down = true;
    this.pressX = this.lastX = x;
    this.pressY = this.lastY = y;
    this.moved = 0;
    this.dragging = false;
  }

  private trackMove(x: number, y: number): void {
    if (!this.pointer.down) return;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    this.moved += Math.hypot(dx, dy);
    if (this.moved > TAP_SLOP) this.dragging = true;
    if (this.dragging) {
      this.panDX += dx;
      this.panDY += dy;
    }
  }

  private endPress(x: number, y: number, button: number): void {
    this.pointer.down = false;
    const dist = Math.hypot(x - this.pressX, y - this.pressY);
    if (!this.dragging && dist <= TAP_SLOP) {
      this.clickQueue.push({ x, y, button });
    }
    this.dragging = false;
  }

  // True while the user is dragging (panning) rather than aiming a tap.
  get isDragging(): boolean {
    return this.dragging;
  }

  // Drain accumulated drag pan (virtual px) since the last call.
  takePan(): { dx: number; dy: number } {
    const p = { dx: this.panDX, dy: this.panDY };
    this.panDX = 0;
    this.panDY = 0;
    return p;
  }

  // Drain taps accumulated since last frame.
  takeClicks(): { x: number; y: number; button: number }[] {
    const c = this.clickQueue;
    this.clickQueue = [];
    return c;
  }

  takeKeys(): string[] {
    const k = this.keyQueue;
    this.keyQueue = [];
    return k;
  }

  isKeyDown(k: string): boolean {
    return this.keysDown.has(k);
  }
}
