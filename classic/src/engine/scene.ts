// Scene + SceneManager: owns transitions between Adventure / Town / Battle, etc.
import { Renderer } from "./renderer";
import { Input } from "./input";

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number, input: Input): void;
  draw(r: Renderer): void;
}

export class SceneManager {
  private stack: Scene[] = [];

  get current(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  replace(scene: Scene): void {
    const old = this.stack.pop();
    old?.exit?.();
    this.stack.push(scene);
    scene.enter?.();
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop(): void {
    const old = this.stack.pop();
    old?.exit?.();
    this.current?.enter?.();
  }

  update(dt: number, input: Input): void {
    this.current?.update(dt, input);
  }

  draw(r: Renderer): void {
    this.current?.draw(r);
  }
}
