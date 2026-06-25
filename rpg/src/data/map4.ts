// Chapter 4 — "The Emberwastes": a volcanic hell of scorched ashland, molten lava
// lakes and wind-blown ash-sand, hemmed by sheer black rock. The warlock dragon-
// lords roost in the Cinder Spire. Lava is impassable, so the routes thread the
// narrow ash flats between the burning lakes.
import { MapGrid, BuiltLevel } from "./mapgen";
import { FactionId, FACTIONS } from "./factions";

export const OBSIDIAN_FORGE: [number, number] = [29, 8]; // reach-quest target

export function buildMap4(playerFaction: FactionId, enemyFaction: FactionId): BuiltLevel {
  const W = 36, H = 36;
  const g = new MapGrid(W, H, "ash", 0x4a1de00b, "ash");

  // jagged black-rock rim
  g.border("rock", 0.55);
  for (let i = 0; i < 14; i++) g.set(2 + Math.floor(g.rnd() * (W - 4)), g.rnd() < 0.5 ? 2 : H - 3, "rock");

  // molten lava lakes (impassable) — the defining hazard of the realm
  g.blob(22, 20, 7, 5, "lava", 0.92);
  g.blob(12, 26, 4, 3, "lava", 0.9);
  g.blob(27, 12, 3, 4, "lava", 0.88);
  // a basalt landbridge of ash across the great lake keeps the east reachable
  g.ribbon([[16, 20], [20, 19], [24, 18], [28, 17]], "ash");

  // drifts of ash-sand and cracked rock fields
  g.clusters([[9, 14], [18, 8], [30, 24], [7, 22]], 3, "sand", 0.55, "ash");
  g.clusters([[14, 12], [24, 26], [31, 16]], 2, "rock", 0.55, "ash");

  // obsidian ridges that wall off lanes (with one gap each)
  for (let y = 7; y <= 13; y++) if (y !== 10) g.set(16, y, "rock");
  for (let x = 9; x <= 15; x++) if (x !== 12) g.set(x, 22, "rock");

  // a scorched road of beaten ash-dirt from the keep to the Cinder Spire
  g.ribbon([[6, 17], [10, 16], [13, 14], [16, 10], [20, 9], [24, 8], [28, 7], [30, 6]], "dirt");

  const guard = (s: { id: import("./creatures").CreatureId; count: number }[]) => s;

  // ---- player's basalt redoubt ----
  const castle = g.place({
    type: "castle", x: 5, y: 17, owner: "player",
    name: FACTIONS[playerFaction].townName, faction: playerFaction,
  });
  for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [1, -1]]) g.clear(5 + dx, 17 + dy);

  // ---- story NPCs ----
  // Pyra the Emberseer reads the lava-tides at the gate — the chapter's hub.
  g.place({ type: "npc", x: 7, y: 18, npcId: "emberseer", name: "Pyra the Emberseer" });
  // A ragged prospector picks the ash flats — the chapter's guide.
  g.place({ type: "npc", x: 15, y: 13, npcId: "prospector", name: "Cinder-Jack" });
  // A soot-caked smith near the forge road: flavor and a gift.
  g.place({ type: "npc", x: 20, y: 10, npcId: "smith", name: "Goro the Smith" });

  // The Obsidian Forge on the high shelf — goal of the reach quest.
  g.place({
    type: "sign", x: OBSIDIAN_FORGE[0], y: OBSIDIAN_FORGE[1],
    text: "The Obsidian Forge still breathes heat. Quench your blade here and dragonfire will not bite so deep.",
  });

  // ---- mines (guarded by fire-beasts) ----
  g.place({ type: "mine", x: 9, y: 24, owner: "neutral", mineKind: "ore",
    name: "Cinder Pit", guard: guard([{ id: "troglodyte", count: 16 }]) });
  g.place({ type: "mine", x: 13, y: 8, owner: "neutral", mineKind: "sulfur",
    name: "Brimstone Vent", guard: guard([{ id: "harpy", count: 10 }]) });
  g.place({ type: "mine", x: 30, y: 27, owner: "neutral", mineKind: "gold",
    name: "Magma Foundry", guard: guard([{ id: "minotaur", count: 5 }]) });

  // ---- resources ----
  g.place({ type: "resource", x: 12, y: 16, resKind: "gold", amount: 1600 });
  g.place({ type: "resource", x: 8, y: 20, resKind: "ore", amount: 9 });
  g.place({ type: "resource", x: 18, y: 16, resKind: "sulfur", amount: 6 });
  g.place({ type: "resource", x: 31, y: 21, resKind: "gems", amount: 6 });
  g.place({ type: "resource", x: 25, y: 6, resKind: "mercury", amount: 6 });

  // ---- chests ----
  g.place({ type: "chest", x: 19, y: 7, amount: 2400 });
  g.place({ type: "chest", x: 14, y: 18, amount: 1800 });

  // ---- roaming monsters ----
  // The fire-drake (quest target l4_drake).
  g.place({ type: "monster", x: 18, y: 13, owner: "neutral", questId: "l4_drake",
    guard: guard([{ id: "dragon", count: 1 }, { id: "harpy", count: 8 }]), reward: { gold: 1500, sulfur: 4 } });
  g.place({ type: "monster", x: 11, y: 11, owner: "neutral",
    guard: guard([{ id: "minotaur", count: 6 }]), reward: { gold: 800 } });
  g.place({ type: "monster", x: 24, y: 14, owner: "neutral",
    guard: guard([{ id: "manticore", count: 4 }]), reward: { mercury: 5 } });
  g.place({ type: "monster", x: 27, y: 9, owner: "neutral",
    guard: guard([{ id: "gazer", count: 8 }, { id: "troglodyte", count: 14 }]), reward: { gold: 1300 } });

  // ---- decorative rocks (few trees survive here) ----
  for (const [x, y] of [[10, 18], [17, 6], [29, 15], [8, 27], [32, 23], [22, 24]]) g.prop(x, y, { type: "rock" });

  // ---- the Cinder Spire: chapter's stronghold (l4_spire) ----
  const eLine = FACTIONS[enemyFaction].lineup;
  const stronghold = g.place({
    type: "stronghold", x: 30, y: 6, owner: "enemy", questId: "l4_spire",
    name: `${FACTIONS[enemyFaction].townName} Spire`, faction: enemyFaction,
    guard: guard([{ id: eLine[5], count: 2 }, { id: eLine[4], count: 8 }, { id: eLine[3], count: 14 }]),
  });

  g.ensureReachable(6, 17);
  return { map: g.build(), castle, stronghold, startX: 6, startY: 17 };
}
