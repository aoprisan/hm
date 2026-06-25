// 8-directional A* over the adventure map. The goal tile may be an interactive
// object (castle/mine/monster) that blocks transit — it's allowed only as the
// final step. Also reused by the battle grid via a generic variant.
import { GameMap } from "./map";

export interface PathTile {
  x: number;
  y: number;
  cost: number; // movement points to enter this tile
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function findPath(map: GameMap, sx: number, sy: number, gx: number, gy: number): PathTile[] | null {
  if (sx === gx && sy === gy) return [];
  const goalInteractive = map.isInteractiveGoal(gx, gy);
  if (!map.passableForTransit(gx, gy) && !goalInteractive) return null;

  const key = (x: number, y: number) => y * map.width + x;
  const open = new Set<number>();
  const came = new Map<number, number>();
  const g = new Map<number, number>();
  const f = new Map<number, number>();
  const h = (x: number, y: number) => Math.hypot(x - gx, y - gy) * 100;

  const start = key(sx, sy);
  g.set(start, 0);
  f.set(start, h(sx, sy));
  open.add(start);

  while (open.size) {
    // pop lowest f
    let cur = -1;
    let best = Infinity;
    for (const n of open) {
      const fn = f.get(n) ?? Infinity;
      if (fn < best) { best = fn; cur = n; }
    }
    open.delete(cur);
    const cx = cur % map.width;
    const cy = Math.floor(cur / map.width);
    if (cx === gx && cy === gy) {
      // reconstruct
      const out: PathTile[] = [];
      let n = cur;
      while (n !== start) {
        const x = n % map.width;
        const y = Math.floor(n / map.width);
        const stepCost = map.moveCost(x, y) || 100;
        out.push({ x, y, cost: stepCost });
        n = came.get(n)!;
      }
      out.reverse();
      // recompute diagonal-adjusted entry cost
      let px = sx, py = sy;
      for (const t of out) {
        const diag = t.x !== px && t.y !== py;
        const base = (t.x === gx && t.y === gy && goalInteractive) ? 0 : (map.moveCost(t.x, t.y) || 100);
        t.cost = Math.round(base * (diag ? 1.4142 : 1));
        px = t.x; py = t.y;
      }
      return out;
    }

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!map.inBounds(nx, ny)) continue;
      const isGoal = nx === gx && ny === gy;
      const enterable = map.passableForTransit(nx, ny) || (isGoal && goalInteractive);
      if (!enterable) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag) {
        // forbid cutting corners between two blockers
        if (!map.passableForTransit(cx + dx, cy) && !map.passableForTransit(cx, cy + dy)) continue;
      }
      const stepBase = isGoal && goalInteractive ? 0 : (map.moveCost(nx, ny) || 100);
      const step = stepBase * (diag ? 1.4142 : 1);
      const nk = key(nx, ny);
      const tentative = (g.get(cur) ?? Infinity) + step;
      if (tentative < (g.get(nk) ?? Infinity)) {
        came.set(nk, cur);
        g.set(nk, tentative);
        f.set(nk, tentative + h(nx, ny));
        open.add(nk);
      }
    }
  }
  return null;
}
