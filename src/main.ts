// Entry point: boot the renderer, input and game loop.
import { Renderer } from "./engine/renderer";
import { Input } from "./engine/input";
import { startLoop } from "./engine/loop";
import { App } from "./app";

function boot(): void {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  const input = new Input(renderer);
  const app = new App(renderer, input);

  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";

  startLoop((dt) => {
    app.scenes.update(dt, input);
    app.scenes.draw(renderer);
  });
}

boot();
