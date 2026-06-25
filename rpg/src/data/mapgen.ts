// Shared map-construction toolkit used by the campaign's handcrafted realms.
// Each level builder spins up a `MapGrid` (a seeded terrain canvas), paints its
// land with the helpers below, hand-places interactive objects, and then asks
// `carveTo` / `ensureReachable` to guarantee every objective can be walked to —
// so no generated layout can ever soft-lock a chapter.
import { GameMap, MapObject, Owner } from "../game/map";
import { TerrainKind, TERRAIN } from "./terrain";

// Small, fast deterministic PRNG so every realm regenerates identically.
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MapGrid {
  readonly W: number;
  readonly H: number;
  tiles: TerrainKind[];
  objs: MapObject[] = [];
  rnd: () => number;
  private nextId = 1;
  // Terrain that `clear()` lays down under an object / when carving a path.
  walkBase: TerrainKind;

  constructor(W: number, H: number, fill: TerrainKind, seed: number, walkBase?: TerrainKind) {
    this.W = W;
    this.H = H;
    this.tiles = new Array(W * H).fill(fill);
    this.rnd = seeded(seed);
    this.walkBase = walkBase ?? fill;
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }
  get(x: number, y: number): TerrainKind {
    return this.tiles[y * this.W + x];
  }
  set(x: number, y: number, t: TerrainKind): void {
    if (this.inb(x, y)) this.tiles[y * this.W + x] = t;
  }
  passable(x: number, y: number): boolean {
    return this.inb(x, y) && TERRAIN[this.get(x, y)].passable;
  }

  // Ring of impassable terrain around the edge, optionally roughened inward.
  border(t: TerrainKind, jitter = 0.5): void {
    for (let x = 0; x < this.W; x++) {
      this.set(x, 0, t); this.set(x, this.H - 1, t);
      if (this.rnd() < jitter) this.set(x, 1, t);
      if (this.rnd() < jitter) this.set(x, this.H - 2, t);
    }
    for (let y = 0; y < this.H; y++) {
      this.set(0, y, t); this.set(this.W - 1, y, t);
      if (this.rnd() < jitter) this.set(1, y, t);
      if (this.rnd() < jitter) this.set(this.W - 2, y, t);
    }
  }

  // Filled ellipse of terrain `t`. `prob` < 1 dapples the fill for soft edges.
  blob(cx: number, cy: number, rx: number, ry: number, t: TerrainKind, prob = 1): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 && this.rnd() < prob) this.set(x, y, t);
      }
    }
  }

  // Scatter soft circular clusters of `t` around each center (e.g. woods, bogs).
  clusters(centers: [number, number][], radius: number, t: TerrainKind, prob: number, only?: TerrainKind): void {
    for (const [cx, cy] of centers) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if (!this.inb(x, y)) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d < radius && this.rnd() < prob && (!only || this.get(x, y) === only)) this.set(x, y, t);
        }
      }
    }
  }

  // Paint a terrain ribbon following a polyline of waypoints (a road / river).
  ribbon(points: [number, number][], t: TerrainKind, width = 0): void {
    const stamp = (x: number, y: number) => {
      this.set(x, y, t);
      for (let i = 1; i <= width; i++) { this.set(x, y + i, t); this.set(x + i, y, t); }
    };
    for (let i = 0; i < points.length - 1; i++) {
      this.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], stamp);
    }
  }

  // Bresenham-ish walk between two tiles, calling `cb` on each.
  private line(x0: number, y0: number, x1: number, y1: number, cb: (x: number, y: number) => void): void {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (;;) {
      cb(x, y);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  // Turn an impassable tile into walkable base terrain (used under objects).
  clear(x: number, y: number): void {
    if (this.inb(x, y) && !TERRAIN[this.get(x, y)].passable) this.set(x, y, this.walkBase);
  }

  // Carve a guaranteed walkable corridor of base terrain between two tiles.
  carveTo(x0: number, y0: number, x1: number, y1: number): void {
    this.line(x0, y0, x1, y1, (x, y) => this.clear(x, y));
  }

  place(o: Omit<MapObject, "id">): MapObject {
    this.clear(o.x, o.y);
    const obj: MapObject = { id: this.nextId++, ...o };
    this.objs.push(obj);
    return obj;
  }

  // Decorative props only added when their tile is currently walkable.
  prop(x: number, y: number, o: Omit<MapObject, "id" | "x" | "y">): void {
    if (this.passable(x, y) && !this.objs.some((p) => p.x === x && p.y === y)) {
      this.place({ x, y, ...o });
    }
  }

  // Flood from `(sx,sy)` over passable tiles; if any interactive objective is
  // still unreachable, carve a straight corridor to it. Belt-and-braces against
  // a procedural wall sealing off a quest target.
  ensureReachable(sx: number, sy: number): void {
    const seen = new Uint8Array(this.W * this.H);
    const stack = [[sx, sy]];
    seen[sy * this.W + sx] = 1;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!this.inb(nx, ny) || seen[ny * this.W + nx]) continue;
        if (!TERRAIN[this.get(nx, ny)].passable) continue;
        seen[ny * this.W + nx] = 1;
        stack.push([nx, ny]);
      }
    }
    // Signs are reach-quest targets, so they must be reachable too.
    const interactive = new Set(["castle", "stronghold", "mine", "monster", "npc", "sign"]);
    for (const o of this.objs) {
      if (!interactive.has(o.type)) continue;
      // reachable if any orthogonal neighbour was flooded
      const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = o.x + dx, ny = o.y + dy;
        return this.inb(nx, ny) && seen[ny * this.W + nx];
      });
      if (!ok) this.carveTo(sx, sy, o.x, o.y);
    }
  }

  build(): GameMap {
    return new GameMap(this.W, this.H, this.tiles, this.objs);
  }
}

// Common result shape every level builder returns.
export interface BuiltLevel {
  map: GameMap;
  castle: MapObject;
  stronghold: MapObject;
  startX: number;
  startY: number;
}

// Convenience re-export so builders can type owners without a deep import.
export type { Owner };
