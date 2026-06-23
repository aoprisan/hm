// Input: tracks mouse position (in virtual coords), click events, and keys.
import { Renderer } from "./renderer";

export interface PointerState {
  x: number; // virtual coords
  y: number;
  down: boolean;
}

export class Input {
  readonly pointer: PointerState = { x: 0, y: 0, down: false };
  private clickQueue: { x: number; y: number; button: number }[] = [];
  private keysDown = new Set<string>();
  private keyQueue: string[] = [];

  constructor(renderer: Renderer) {
    const canvas = renderer.canvas;
    canvas.addEventListener("mousemove", (e) => {
      const v = renderer.toVirtual(e.clientX, e.clientY);
      this.pointer.x = v.x;
      this.pointer.y = v.y;
    });
    canvas.addEventListener("mousedown", () => {
      this.pointer.down = true;
    });
    window.addEventListener("mouseup", () => {
      this.pointer.down = false;
    });
    canvas.addEventListener("click", (e) => {
      const v = renderer.toVirtual(e.clientX, e.clientY);
      this.clickQueue.push({ x: v.x, y: v.y, button: e.button });
    });
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const v = renderer.toVirtual(e.clientX, e.clientY);
      this.clickQueue.push({ x: v.x, y: v.y, button: 2 });
    });
    window.addEventListener("keydown", (e) => {
      if (!this.keysDown.has(e.key)) this.keyQueue.push(e.key);
      this.keysDown.add(e.key);
    });
    window.addEventListener("keyup", (e) => this.keysDown.delete(e.key));
  }

  // Drain clicks accumulated since last frame.
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
