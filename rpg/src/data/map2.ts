// Chapter 2 — "Frostmere Reach": a frozen north of deep snow, a cracked ice lake
// and black pine. The undead of the Barrow-king stir beneath the glacier. The
// land reads cold and open, with ice "roads" that move fast and snow that drags.
import { MapGrid, BuiltLevel } from "./mapgen";
import { FactionId, FACTIONS } from "./factions";

export const FROSTMERE_SHRINE: [number, number] = [28, 6]; // reach-quest target

export function buildMap2(playerFaction: FactionId, enemyFaction: FactionId): BuiltLevel {
  const W = 36, H = 36;
  const g = new MapGrid(W, H, "snow", 0x2b10c0fe, "snow");

  // jagged mountain rim, heavier on the frozen north edge
  g.border("mountain", 0.55);
  for (let x = 4; x < W - 4; x++) if (g.rnd() < 0.4) g.set(x, 2, "mountain");

  // a great frozen lake in the east: an ice sheet ringed by open water leads
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - 24) / 9, dy = (y - 20) / 6;
      const d = dx * dx + dy * dy;
      if (d < 0.6) g.set(x, y, "ice");
      else if (d < 1) g.set(x, y, "water");
    }
  }
  // a slick ice causeway spanning the lake so the east stays reachable on foot
  g.ribbon([[16, 18], [22, 17], [28, 16], [31, 14]], "ice");

  // black pine forests and scattered boulders
  g.clusters([[10, 27], [13, 9], [29, 27], [8, 14]], 3, "forest", 0.6, "snow");
  g.clusters([[18, 7], [26, 11], [6, 24]], 2, "rock", 0.5, "snow");

  // glacial ridges that funnel the route (with gaps)
  for (let y = 8; y <= 14; y++) if (y !== 11) g.set(15, y, "rock");
  for (let x = 20; x <= 27; x++) if (x !== 24) g.set(x, 24, "rock");

  // a packed-snow trail from keep to barrow
  g.ribbon([[6, 18], [10, 17], [14, 15], [16, 13], [20, 12], [24, 10], [28, 8], [30, 6]], "dirt");

  const guard = (s: { id: import("./creatures").CreatureId; count: number }[]) => s;

  // ---- the player's outpost ----
  const castle = g.place({
    type: "castle", x: 5, y: 18, owner: "player",
    name: FACTIONS[playerFaction].townName, faction: playerFaction,
  });
  for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [1, -1]]) g.clear(5 + dx, 18 + dy);

  // ---- story NPCs ----
  // Brother Caedmon keeps a cold vigil by the gate — the chapter's hub.
  g.place({ type: "npc", x: 7, y: 19, npcId: "monk", name: "Brother Caedmon" });
  // Yetra the Trapper ranges the central snowfields — the chapter's guide.
  g.place({ type: "npc", x: 17, y: 14, npcId: "trapper", name: "Yetra the Trapper" });
  // An ice-fisher by the lake: flavor and a one-time gift.
  g.place({ type: "npc", x: 19, y: 19, npcId: "iceFisher", name: "Old Halvard" });

  // The Frostfont shrine on the northern ice — goal of the reach quest.
  g.place({
    type: "sign", x: FROSTMERE_SHRINE[0], y: FROSTMERE_SHRINE[1],
    text: "The Frostfont: a frozen spring ringed with rime-runes. Its meltwater wards against the barrow-cold.",
  });

  // ---- mines (guarded by frost-beasts and the restless dead) ----
  g.place({ type: "mine", x: 9, y: 25, owner: "neutral", mineKind: "wood",
    name: "Frozen Lumberyard", guard: guard([{ id: "wolf", count: 6 }]) });
  g.place({ type: "mine", x: 11, y: 10, owner: "neutral", mineKind: "ore",
    name: "Glacier Mine", guard: guard([{ id: "skeleton", count: 14 }]) });
  g.place({ type: "mine", x: 27, y: 28, owner: "neutral", mineKind: "crystal",
    name: "Rime Crystals", guard: guard([{ id: "zombie", count: 8 }]) });

  // ---- resources ----
  g.place({ type: "resource", x: 13, y: 17, resKind: "gold", amount: 1200 });
  g.place({ type: "resource", x: 8, y: 22, resKind: "wood", amount: 7 });
  g.place({ type: "resource", x: 22, y: 8, resKind: "crystal", amount: 5 });
  g.place({ type: "resource", x: 30, y: 30, resKind: "gems", amount: 5 });
  g.place({ type: "resource", x: 16, y: 27, resKind: "mercury", amount: 4 });

  // ---- chests ----
  g.place({ type: "chest", x: 18, y: 11, amount: 1800 });
  g.place({ type: "chest", x: 30, y: 20, amount: 2200 });

  // ---- roaming monsters ----
  // The frost-wolf pack (quest target l2_wolves).
  g.place({ type: "monster", x: 21, y: 21, owner: "neutral", questId: "l2_wolves",
    guard: guard([{ id: "wolf", count: 9 }]), reward: { gold: 800, crystal: 2 } });
  g.place({ type: "monster", x: 12, y: 13, owner: "neutral",
    guard: guard([{ id: "skeleton", count: 18 }]), reward: { gold: 500 } });
  g.place({ type: "monster", x: 25, y: 14, owner: "neutral",
    guard: guard([{ id: "ghost", count: 5 }]), reward: { gems: 3 } });
  g.place({ type: "monster", x: 27, y: 9, owner: "neutral",
    guard: guard([{ id: "zombie", count: 10 }, { id: "skeleton", count: 12 }]), reward: { gold: 900 } });

  // ---- decorative pines / rocks ----
  for (const [x, y] of [[4, 15], [14, 23], [31, 12], [6, 28], [33, 25]]) g.prop(x, y, { type: "tree", variant: (x + y) % 2 });
  for (const [x, y] of [[10, 20], [23, 6], [29, 17]]) g.prop(x, y, { type: "rock" });

  // ---- the Barrow of the undead king: chapter's stronghold (l2_barrow) ----
  const eLine = FACTIONS[enemyFaction].lineup;
  const stronghold = g.place({
    type: "stronghold", x: 30, y: 6, owner: "enemy", questId: "l2_barrow",
    name: `${FACTIONS[enemyFaction].townName} Barrow`, faction: enemyFaction,
    guard: guard([{ id: eLine[5], count: 1 }, { id: eLine[4], count: 7 }, { id: eLine[3], count: 10 }]),
  });

  g.ensureReachable(6, 18);
  return { map: g.build(), castle, stronghold, startX: 6, startY: 18 };
}
