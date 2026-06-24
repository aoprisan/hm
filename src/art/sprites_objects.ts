// Adventure-map object art: hero, castle, enemy stronghold, mines, resource
// piles, chests, signposts and decorative trees/rocks. Buildings are drawn on
// canvases (easy shapes); the hero is a pixel sprite so it can face/flip.
import { PixelSprite } from "./pixelsprite";
import { ResourceKind } from "../data/resources";
import { Owner } from "../game/map";
import { FactionId, FACTIONS } from "../data/factions";

function cv(w: number, h: number): { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  return { cv: el, c: el.getContext("2d")! };
}
function r(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

// ---------- Hero (pixel sprite, faces right; flip for left) ----------
export const heroSprite = new PixelSprite([
  ".....zz.....",
  "....zhhz....",
  "....zssz....",
  "....ssss....",
  "...zzzzzz...",
  "..ruuuuuur..",
  ".rRuuyyuuRr.",
  ".rRuuyyuuRr.",
  ".rRuuuuuuRr.",
  "..RuuuuuuR..",
  "...zuuuuz...",
  "...zz..zz...",
  "...bb..bb...",
  "...bb..bb...",
  "...kk..kk...",
  "..kkk..kkk..",
]);

// ---------- Castle ----------
export function castleSprite(owner: Owner, faction?: FactionId): HTMLCanvasElement {
  const { cv: el, c } = cv(88, 80);
  const flag = owner === "enemy" ? "#c8413a" : owner === "player" ? "#3f78c8" : "#9b938a";
  const stone = "#b8b0a2";
  const stoneDk = "#7d756a";
  // Faction themes the roofs; owner still drives the flag color.
  const roof = faction ? FACTIONS[faction].palette.roofPrimary
    : owner === "enemy" ? "#8f2b27" : "#28548f";
  // ground shadow
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(44, 76, 38, 6, 0, 0, Math.PI * 2);
  c.fill();
  // main keep
  r(c, 28, 28, 32, 48, stone);
  r(c, 28, 28, 6, 48, "#cfc7b8");
  r(c, 54, 28, 6, 48, stoneDk);
  // crenellations
  for (let i = 0; i < 4; i++) r(c, 28 + i * 8, 24, 5, 6, stone);
  // door
  r(c, 38, 58, 12, 18, "#3a2410");
  r(c, 40, 60, 8, 16, "#5b3a1a");
  // windows
  r(c, 34, 40, 4, 7, "#1c1610");
  r(c, 50, 40, 4, 7, "#1c1610");
  // side towers
  for (const tx of [10, 64]) {
    r(c, tx, 36, 16, 40, stone);
    r(c, tx, 36, 4, 40, "#cfc7b8");
    r(c, tx + 12, 36, 4, 40, stoneDk);
    for (let i = 0; i < 2; i++) r(c, tx + i * 8, 32, 5, 6, stone);
    // conical roof
    c.fillStyle = roof;
    c.beginPath();
    c.moveTo(tx + 8, 18);
    c.lineTo(tx + 18, 38);
    c.lineTo(tx - 2, 38);
    c.closePath();
    c.fill();
    r(c, tx + 6, 46, 4, 6, "#1c1610");
    // flag
    r(c, tx + 7, 8, 2, 12, "#3a2410");
    c.fillStyle = flag;
    c.beginPath();
    c.moveTo(tx + 9, 8);
    c.lineTo(tx + 17, 11);
    c.lineTo(tx + 9, 14);
    c.closePath();
    c.fill();
  }
  // central tall roof
  c.fillStyle = roof;
  c.beginPath();
  c.moveTo(44, 6);
  c.lineTo(60, 26);
  c.lineTo(28, 26);
  c.closePath();
  c.fill();
  r(c, 42, 0, 4, 8, "#3a2410");
  c.fillStyle = flag;
  c.beginPath();
  c.moveTo(46, 0);
  c.lineTo(58, 4);
  c.lineTo(46, 8);
  c.closePath();
  c.fill();
  return el;
}

// ---------- Enemy stronghold (dark tower) ----------
export function strongholdSprite(faction?: FactionId): HTMLCanvasElement {
  const { cv: el, c } = cv(64, 80);
  c.fillStyle = "rgba(0,0,0,0.3)";
  c.beginPath();
  c.ellipse(32, 76, 28, 6, 0, 0, Math.PI * 2);
  c.fill();
  const dk = "#5f574c";
  const dkk = "#3f3a33";
  const spire = faction ? FACTIONS[faction].palette.roofPrimary : "#8f2b27";
  r(c, 18, 22, 28, 54, dk);
  r(c, 18, 22, 5, 54, "#6b645c");
  r(c, 41, 22, 5, 54, dkk);
  for (let i = 0; i < 4; i++) r(c, 18 + i * 8, 18, 5, 6, dk);
  r(c, 27, 56, 10, 20, "#1c1610");
  r(c, 24, 34, 5, 8, "#c8413a");
  r(c, 36, 34, 5, 8, "#c8413a");
  // jagged spire
  c.fillStyle = spire;
  c.beginPath();
  c.moveTo(32, 2);
  c.lineTo(46, 20);
  c.lineTo(18, 20);
  c.closePath();
  c.fill();
  r(c, 30, 0, 4, 6, "#1c1610");
  // skull banner
  c.fillStyle = "#1c1610";
  r(c, 8, 28, 2, 16, "#1c1610");
  c.fillStyle = "#c8413a";
  c.beginPath();
  c.moveTo(10, 28);
  c.lineTo(18, 31);
  c.lineTo(10, 34);
  c.closePath();
  c.fill();
  return el;
}

// ---------- Mine ----------
export function mineSprite(kind: ResourceKind): HTMLCanvasElement {
  const { cv: el, c } = cv(44, 40);
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(22, 37, 18, 4, 0, 0, Math.PI * 2);
  c.fill();
  if (kind === "wood") {
    // sawmill: log cabin + saw
    r(c, 8, 16, 28, 18, "#8a5a2b");
    for (let i = 0; i < 4; i++) r(c, 8, 16 + i * 4, 28, 2, "#5b3a1a");
    c.fillStyle = "#7d756a"; // roof
    c.beginPath(); c.moveTo(6, 16); c.lineTo(22, 6); c.lineTo(38, 16); c.closePath(); c.fill();
    r(c, 18, 24, 8, 10, "#3a2410");
    // logs
    r(c, 2, 30, 10, 4, "#b9824a"); r(c, 3, 30, 2, 4, "#5b3a1a");
  } else {
    // mine: hill + tunnel entrance + ore cart
    c.fillStyle = "#7d756a";
    c.beginPath(); c.moveTo(4, 34); c.lineTo(20, 10); c.lineTo(40, 34); c.closePath(); c.fill();
    c.fillStyle = "#5f574c";
    c.beginPath(); c.moveTo(20, 10); c.lineTo(40, 34); c.lineTo(22, 34); c.closePath(); c.fill();
    // tunnel
    r(c, 14, 22, 12, 12, "#1c1610");
    r(c, 12, 20, 16, 3, "#3a2410");
    // a glinting ore/gold chunk by the entrance
    const gem = kind === "gold" ? "#f2c44d" : kind === "ore" ? "#b85f18" : "#6fb0e6";
    r(c, 30, 30, 5, 4, gem);
    r(c, 31, 30, 2, 1, "#fff0b0");
  }
  return el;
}

// owner flag drawn next to a building/mine
export function flagSprite(owner: Owner): HTMLCanvasElement {
  const { cv: el, c } = cv(10, 18);
  r(c, 4, 0, 2, 18, "#3a2410");
  const col = owner === "player" ? "#3f78c8" : owner === "enemy" ? "#c8413a" : "#cfc7b8";
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(6, 1);
  c.lineTo(10, 4);
  c.lineTo(6, 7);
  c.closePath();
  c.fill();
  return el;
}

// ---------- Resource pile ----------
export function resourcePile(kind: ResourceKind): HTMLCanvasElement {
  const { cv: el, c } = cv(24, 20);
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(12, 18, 10, 3, 0, 0, Math.PI * 2);
  c.fill();
  switch (kind) {
    case "gold":
      for (const [x, y] of [[6, 12], [12, 12], [9, 8], [11, 5]]) {
        r(c, x, y, 7, 4, "#c8922a"); r(c, x, y, 7, 2, "#f2c44d"); r(c, x + 1, y, 2, 1, "#fff0b0");
      }
      break;
    case "wood":
      r(c, 3, 11, 18, 4, "#8a5a2b"); r(c, 3, 11, 18, 2, "#b9824a");
      r(c, 5, 7, 14, 4, "#8a5a2b"); r(c, 5, 7, 14, 2, "#b9824a");
      r(c, 4, 11, 2, 4, "#5b3a1a"); r(c, 19, 11, 2, 4, "#5b3a1a");
      break;
    case "ore":
      r(c, 4, 11, 16, 7, "#7d756a"); r(c, 6, 8, 10, 5, "#9b938a");
      r(c, 5, 11, 4, 3, "#b85f18"); r(c, 13, 13, 4, 3, "#b85f18");
      break;
    default: {
      const col = kind === "mercury" ? "#d94f7a" : kind === "sulfur" ? "#f2c44d"
        : kind === "crystal" ? "#a9d8f0" : "#c98ad8";
      r(c, 8, 8, 8, 10, col); r(c, 9, 8, 3, 10, "#ffffff");
      r(c, 7, 12, 10, 4, col);
    }
  }
  return el;
}

// ---------- Chest ----------
export function chestSprite(): HTMLCanvasElement {
  const { cv: el, c } = cv(24, 20);
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(12, 18, 10, 3, 0, 0, Math.PI * 2);
  c.fill();
  r(c, 4, 8, 16, 10, "#8a5a2b");
  r(c, 4, 6, 16, 5, "#b9824a");
  r(c, 4, 9, 16, 2, "#3a2410");
  r(c, 4, 8, 16, 2, "#f2c44d");
  r(c, 11, 9, 2, 4, "#f2c44d");
  return el;
}

// ---------- Signpost ----------
export function signSprite(): HTMLCanvasElement {
  const { cv: el, c } = cv(20, 22);
  r(c, 9, 6, 2, 14, "#5b3a1a");
  r(c, 3, 4, 14, 8, "#b9824a");
  r(c, 3, 4, 14, 2, "#d8b483");
  for (let i = 0; i < 3; i++) r(c, 5, 7 + i * 2, 10, 1, "#5b3a1a");
  return el;
}

// ---------- Decorative tree / rock (single-tile obstacle objects) ----------
export function bigTree(variant: number): HTMLCanvasElement {
  const { cv: el, c } = cv(28, 34);
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(14, 32, 11, 3, 0, 0, Math.PI * 2);
  c.fill();
  r(c, 12, 22, 4, 10, "#5b3a1a");
  r(c, 12, 22, 2, 10, "#7a4f25");
  const g1 = variant % 2 ? "#3c6e2c" : "#2f5a22";
  c.fillStyle = g1;
  c.beginPath(); c.ellipse(14, 16, 13, 12, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#4f8a3a";
  c.beginPath(); c.ellipse(11, 13, 8, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#79b85a";
  c.beginPath(); c.ellipse(10, 11, 4, 3, 0, 0, Math.PI * 2); c.fill();
  return el;
}

export function bigRock(): HTMLCanvasElement {
  const { cv: el, c } = cv(28, 26);
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.beginPath();
  c.ellipse(14, 24, 12, 3, 0, 0, Math.PI * 2);
  c.fill();
  r(c, 5, 10, 18, 12, "#7d756a");
  r(c, 5, 10, 18, 4, "#9b938a");
  r(c, 5, 18, 18, 4, "#5f574c");
  r(c, 9, 6, 10, 6, "#9b938a");
  return el;
}
