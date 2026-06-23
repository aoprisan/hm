// Compact UI icons (resources) used by the HUD and dialogs.
import { ResourceKind } from "../data/resources";

const cache = new Map<ResourceKind, HTMLCanvasElement>();

function mk(): { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const cv = document.createElement("canvas");
  cv.width = 20;
  cv.height = 18;
  return { cv, c: cv.getContext("2d")! };
}
function r(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

export function resourceIcon(kind: ResourceKind): HTMLCanvasElement {
  const hit = cache.get(kind);
  if (hit) return hit;
  const { cv, c } = mk();
  switch (kind) {
    case "gold":
      c.fillStyle = "#c8922a";
      c.beginPath(); c.ellipse(10, 9, 7, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#f2c44d";
      c.beginPath(); c.ellipse(10, 8, 6, 5, 0, 0, Math.PI * 2); c.fill();
      r(c, 9, 5, 2, 7, "#c8922a");
      break;
    case "wood":
      r(c, 2, 9, 16, 4, "#8a5a2b"); r(c, 2, 9, 16, 2, "#b9824a");
      r(c, 4, 5, 12, 4, "#8a5a2b"); r(c, 4, 5, 12, 2, "#b9824a");
      r(c, 3, 9, 2, 4, "#5b3a1a"); r(c, 15, 9, 2, 4, "#5b3a1a");
      break;
    case "ore":
      r(c, 3, 8, 14, 7, "#7d756a"); r(c, 5, 6, 9, 4, "#9b938a");
      r(c, 4, 8, 4, 3, "#b85f18"); r(c, 12, 11, 3, 3, "#b85f18");
      break;
    case "mercury":
      r(c, 7, 4, 6, 11, "#d94f7a"); r(c, 8, 4, 2, 11, "#ffffff");
      r(c, 6, 9, 8, 4, "#d94f7a");
      break;
    case "sulfur":
      c.fillStyle = "#f2c44d";
      c.beginPath(); c.ellipse(10, 10, 7, 5, 0, 0, Math.PI * 2); c.fill();
      r(c, 6, 6, 4, 3, "#fff0b0");
      break;
    case "crystal":
      c.fillStyle = "#a9d8f0";
      c.beginPath(); c.moveTo(10, 3); c.lineTo(16, 10); c.lineTo(10, 16); c.lineTo(4, 10); c.closePath(); c.fill();
      r(c, 9, 4, 2, 10, "#ffffff");
      break;
    case "gems":
      c.fillStyle = "#c98ad8";
      c.beginPath(); c.moveTo(10, 3); c.lineTo(16, 9); c.lineTo(10, 16); c.lineTo(4, 9); c.closePath(); c.fill();
      r(c, 7, 7, 6, 2, "#f0d0ff");
      break;
  }
  cache.set(kind, cv);
  return cv;
}
