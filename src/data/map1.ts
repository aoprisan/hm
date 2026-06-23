// The single handcrafted adventure map: "The Vale of Sunhaven".
// Terrain is generated deterministically (enclosed by mountains, a lake with a
// bridge, forest clusters), then interactive objects are hand-placed on cleared
// grass tiles. A path from the player castle to the enemy stronghold is ensured.
import { GameMap, MapObject } from "../game/map";
import { TerrainKind } from "./terrain";
import { Stack } from "../game/army";

export const MAP_W = 36;
export const MAP_H = 36;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMap1(): { map: GameMap; castle: MapObject; stronghold: MapObject; startX: number; startY: number } {
  const rnd = seeded(20240608);
  const tiles: TerrainKind[] = new Array(MAP_W * MAP_H).fill("grass");
  const set = (x: number, y: number, t: TerrainKind) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t;
  };
  const get = (x: number, y: number) => tiles[y * MAP_W + x];

  // mountainous border
  for (let x = 0; x < MAP_W; x++) {
    set(x, 0, "mountain"); set(x, MAP_H - 1, "mountain");
    if (rnd() < 0.5) set(x, 1, "mountain");
    if (rnd() < 0.5) set(x, MAP_H - 2, "mountain");
  }
  for (let y = 0; y < MAP_H; y++) {
    set(0, y, "mountain"); set(MAP_W - 1, y, "mountain");
    if (rnd() < 0.5) set(1, y, "mountain");
    if (rnd() < 0.5) set(MAP_W - 2, y, "mountain");
  }

  // a lake in the middle-east with a land bridge across the middle
  const lcx = 23, lcy = 14, lrx = 7, lry = 5;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const dx = (x - lcx) / lrx, dy = (y - lcy) / lry;
      if (dx * dx + dy * dy < 1) set(x, y, "water");
    }
  }
  // bridge of sand across the lake at row lcy
  for (let x = lcx - lrx - 1; x <= lcx + lrx + 1; x++) {
    set(x, lcy, "sand"); set(x, lcy + 1, "sand");
  }

  // forest clusters
  const forestCenters = [[9, 27], [13, 8], [27, 28], [30, 20], [6, 13]];
  for (const [cx, cy] of forestCenters) {
    for (let y = cy - 3; y <= cy + 3; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < 3 && rnd() < 0.7 && get(x, y) === "grass") set(x, y, "forest");
      }
    }
  }

  // a couple of impassable rocky ridges that shape routes (with gaps)
  for (let y = 6; y <= 12; y++) if (y !== 9) set(16, y, "rock");
  for (let x = 9; x <= 15; x++) if (x !== 12) set(x, 22, "rock");

  // a dirt road meandering from the castle toward the stronghold
  const road: [number, number][] = [
    [6, 20], [7, 20], [8, 20], [9, 20], [10, 19], [11, 18], [12, 17], [13, 16],
    [14, 15], [15, 15], [16, 15], [16, 14], [16, 13], [16, 12], [17, 12], [18, 12],
    [19, 11], [20, 10], [21, 9], [22, 8], [24, 8], [26, 8], [28, 7], [29, 7], [30, 7],
  ];
  for (const [x, y] of road) if (get(x, y) !== "water") set(x, y, "dirt");

  let nextId = 1;
  const objs: MapObject[] = [];
  const clear = (x: number, y: number) => {
    if (get(x, y) === "mountain" || get(x, y) === "rock" || get(x, y) === "water") set(x, y, "grass");
  };
  const place = (o: Omit<MapObject, "id">): MapObject => {
    clear(o.x, o.y);
    const obj: MapObject = { id: nextId++, ...o };
    objs.push(obj);
    return obj;
  };
  const guard = (stacks: Stack[]): Stack[] => stacks;

  // player castle
  const castle = place({ type: "castle", x: 5, y: 20, owner: "player", name: "Sunhaven" });
  for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [1, -1]]) clear(5 + dx, 20 + dy);

  // signpost hint near the castle
  place({
    type: "sign", x: 7, y: 21,
    text: "The dark lord's tower lies northeast. Gather strength, brave hero!",
  });

  // mines (each guarded)
  place({
    type: "mine", x: 10, y: 28, owner: "neutral", mineKind: "wood",
    name: "Sawmill", guard: guard([{ id: "wolf", count: 4 }]),
  });
  place({
    type: "mine", x: 8, y: 8, owner: "neutral", mineKind: "ore",
    name: "Ore Mine", guard: guard([{ id: "goblin", count: 8 }]),
  });
  place({
    type: "mine", x: 26, y: 26, owner: "neutral", mineKind: "gold",
    name: "Gold Mine", guard: guard([{ id: "ogre", count: 3 }]),
  });

  // resource piles
  place({ type: "resource", x: 12, y: 18, resKind: "gold", amount: 1000 });
  place({ type: "resource", x: 7, y: 25, resKind: "wood", amount: 6 });
  place({ type: "resource", x: 14, y: 10, resKind: "ore", amount: 6 });
  place({ type: "resource", x: 28, y: 31, resKind: "gems", amount: 4 });
  place({ type: "resource", x: 20, y: 4, resKind: "crystal", amount: 4 });
  place({ type: "resource", x: 31, y: 24, resKind: "wood", amount: 8 });

  // chests
  place({ type: "chest", x: 15, y: 23, amount: 1500 });
  place({ type: "chest", x: 27, y: 13, amount: 2000 });

  // roaming monster stacks (some grant a reward when cleared)
  place({
    type: "monster", x: 9, y: 9, owner: "neutral",
    guard: guard([{ id: "goblin", count: 10 }]), reward: { gold: 500 },
  });
  place({
    type: "monster", x: 18, y: 12, owner: "neutral",
    guard: guard([{ id: "wolf", count: 6 }]),
  });
  place({
    type: "monster", x: 24, y: 8, owner: "neutral",
    guard: guard([{ id: "ogre", count: 4 }, { id: "goblin", count: 6 }]), reward: { gold: 750, ore: 5 },
  });
  place({
    type: "monster", x: 21, y: 16, owner: "neutral",
    guard: guard([{ id: "troll", count: 3 }]), reward: { crystal: 3 },
  });

  // decorative trees / rocks
  for (const [x, y] of [[4, 17], [9, 23], [13, 13], [29, 12], [6, 30], [33, 18]]) {
    if (get(x, y) === "grass") place({ type: "tree", x, y, variant: (x + y) % 2 });
  }
  for (const [x, y] of [[11, 16], [19, 19], [31, 9]]) {
    if (get(x, y) === "grass") place({ type: "rock", x, y });
  }

  // enemy stronghold — the victory target — guarded by a fearsome host
  const stronghold = place({
    type: "stronghold", x: 30, y: 6, owner: "enemy", name: "Dragon's Keep",
    guard: guard([
      { id: "dragon", count: 1 },
      { id: "troll", count: 6 },
      { id: "ogre", count: 8 },
    ]),
  });

  const map = new GameMap(MAP_W, MAP_H, tiles, objs);
  return { map, castle, stronghold, startX: 6, startY: 20 };
}
