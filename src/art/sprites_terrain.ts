// Terrain tiles, drawn procedurally onto 32x32 canvases with deterministic
// texture/dither so the map reads as painterly rather than flat. Each terrain
// exposes a few variants; the map picks one by tile hash.
import { TerrainKind } from "../data/terrain";

export const TILE = 32;

function tileCanvas(): { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const cv = document.createElement("canvas");
  cv.width = TILE;
  cv.height = TILE;
  const c = cv.getContext("2d")!;
  return { cv, c };
}

// cheap deterministic pseudo-random for texture
function hash(x: number, y: number, s: number): number {
  let h = x * 374761393 + y * 668265263 + s * 2246822519;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h >>> 0) / 4294967296;
}

function px(c: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function speckle(c: CanvasRenderingContext2D, seed: number, colors: string[], density: number): void {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const r = hash(x, y, seed);
      if (r < density) px(c, x, y, colors[Math.floor(hash(x, y, seed + 7) * colors.length)]);
    }
  }
}

function grass(variant: number): HTMLCanvasElement {
  const { cv, c } = tileCanvas();
  px(c, 0, 0, "#4f8a3a", TILE, TILE);
  speckle(c, variant + 1, ["#3c6e2c", "#5b9a42"], 0.35);
  speckle(c, variant + 31, ["#6fae4e", "#79b85a"], 0.08);
  // occasional flowers / pebbles
  if (variant % 3 === 0) {
    const fx = 6 + Math.floor(hash(variant, 5, 2) * 18);
    const fy = 6 + Math.floor(hash(variant, 9, 3) * 18);
    const col = ["#f2c44d", "#c98ad8", "#c8413a"][variant % 3];
    px(c, fx, fy, col);
    px(c, fx + 1, fy, "#fff0b0");
    px(c, fx, fy + 1, "#3c6e2c");
  }
  return cv;
}

function dirt(variant: number): HTMLCanvasElement {
  const { cv, c } = tileCanvas();
  px(c, 0, 0, "#b3863f", TILE, TILE);
  speckle(c, variant + 4, ["#7e5a30", "#9c6f3c"], 0.4);
  speckle(c, variant + 14, ["#d8b06a"], 0.08);
  return cv;
}

function sand(variant: number): HTMLCanvasElement {
  const { cv, c } = tileCanvas();
  px(c, 0, 0, "#d8b06a", TILE, TILE);
  speckle(c, variant + 2, ["#c79a52", "#e6c886"], 0.3);
  speckle(c, variant + 22, ["#b3863f"], 0.05);
  return cv;
}

function water(frame: number): HTMLCanvasElement {
  const { cv, c } = tileCanvas();
  px(c, 0, 0, "#2f6fb0", TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const w = Math.sin((x + frame * 4) * 0.5 + y * 0.6) + Math.sin((y - frame * 3) * 0.4);
      if (w > 1.2) px(c, x, y, "#6fb0e6");
      else if (w < -1.2) px(c, x, y, "#1f4f86");
    }
  }
  return cv;
}

function forest(variant: number): HTMLCanvasElement {
  const cv = grass(variant);
  const c = cv.getContext("2d")!;
  // a cluster of little trees
  const trees = 3;
  for (let i = 0; i < trees; i++) {
    const tx = 3 + Math.floor(hash(variant + i, 1, 11) * 22);
    const ty = 6 + Math.floor(hash(variant + i, 2, 12) * 16);
    // trunk
    px(c, tx + 2, ty + 7, "#5b3a1a", 2, 4);
    // canopy
    px(c, tx, ty + 2, "#2f5a22", 6, 5);
    px(c, tx + 1, ty, "#3c6e2c", 4, 4);
    px(c, tx + 2, ty - 1, "#4f8a3a", 2, 2);
    px(c, tx + 1, ty + 1, "#79b85a", 2, 1);
  }
  return cv;
}

function mountain(variant: number): HTMLCanvasElement {
  const { cv, c } = tileCanvas();
  px(c, 0, 0, "#4f8a3a", TILE, TILE); // grass base showing at edges
  speckle(c, variant + 1, ["#3c6e2c"], 0.3);
  // mountain body (triangle-ish)
  c.fillStyle = "#7d756a";
  c.beginPath();
  c.moveTo(16, 2);
  c.lineTo(31, 30);
  c.lineTo(1, 30);
  c.closePath();
  c.fill();
  // shaded right face
  c.fillStyle = "#5f574c";
  c.beginPath();
  c.moveTo(16, 2);
  c.lineTo(31, 30);
  c.lineTo(16, 30);
  c.closePath();
  c.fill();
  // snow cap
  px(c, 14, 3, "#e9e4d6", 4, 3);
  px(c, 13, 6, "#e9e4d6", 6, 2);
  px(c, 16, 5, "#b8b0a2", 3, 4);
  speckle(c, variant + 9, ["#9b938a"], 0.06);
  return cv;
}

function rock(variant: number): HTMLCanvasElement {
  const { cv, c } = tileCanvas();
  px(c, 0, 0, "#4f8a3a", TILE, TILE);
  speckle(c, variant, ["#3c6e2c"], 0.3);
  // a couple of boulders
  for (let i = 0; i < 2; i++) {
    const bx = 4 + Math.floor(hash(variant + i, 3, 5) * 16);
    const by = 8 + Math.floor(hash(variant + i, 4, 6) * 14);
    px(c, bx, by, "#7d756a", 9, 7);
    px(c, bx + 1, by + 1, "#9b938a", 6, 3);
    px(c, bx, by + 6, "#5f574c", 9, 2);
  }
  return cv;
}

export interface TerrainTiles {
  grass: HTMLCanvasElement[];
  dirt: HTMLCanvasElement[];
  sand: HTMLCanvasElement[];
  forest: HTMLCanvasElement[];
  mountain: HTMLCanvasElement[];
  rock: HTMLCanvasElement[];
  water: HTMLCanvasElement[]; // animation frames
}

let cache: TerrainTiles | null = null;

export function terrainTiles(): TerrainTiles {
  if (cache) return cache;
  cache = {
    grass: [grass(0), grass(1), grass(2), grass(3), grass(4), grass(5)],
    dirt: [dirt(0), dirt(1), dirt(2), dirt(3)],
    sand: [sand(0), sand(1), sand(2), sand(3)],
    forest: [forest(0), forest(1), forest(2), forest(3)],
    mountain: [mountain(0), mountain(1), mountain(2)],
    rock: [rock(0), rock(1), rock(2)],
    water: [water(0), water(1), water(2), water(3)],
  };
  return cache;
}

export function terrainTileFor(kind: TerrainKind, variant: number, waterFrame: number): HTMLCanvasElement {
  const t = terrainTiles();
  switch (kind) {
    case "grass": return t.grass[variant % t.grass.length];
    case "dirt": return t.dirt[variant % t.dirt.length];
    case "sand": return t.sand[variant % t.sand.length];
    case "forest": return t.forest[variant % t.forest.length];
    case "mountain": return t.mountain[variant % t.mountain.length];
    case "rock": return t.rock[variant % t.rock.length];
    case "water": return t.water[waterFrame % t.water.length];
  }
}
