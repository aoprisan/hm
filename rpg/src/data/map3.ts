// Chapter 3 — "The Sunder Marsh": a drowned fen of stagnant swamp, winding water
// channels and drowned forest, threaded by narrow grass hummocks. The warlock
// covens of the Mire raise lizardfolk and trolls from the bog. Movement is a
// slog; the dry causeways are the only fast lines through the muck.
import { MapGrid, BuiltLevel } from "./mapgen";
import { FactionId, FACTIONS } from "./factions";

export const MIRE_IDOL: [number, number] = [27, 7]; // reach-quest target

export function buildMap3(playerFaction: FactionId, enemyFaction: FactionId): BuiltLevel {
  const W = 36, H = 36;
  const g = new MapGrid(W, H, "swamp", 0x5eed3a17, "swamp");

  // border of drowned forest with a few mountain teeth
  g.border("forest", 0.4);
  for (let i = 0; i < 10; i++) g.set(2 + Math.floor(g.rnd() * (W - 4)), g.rnd() < 0.5 ? 1 : H - 2, "mountain");

  // sluggish water channels snaking through the fen
  g.ribbon([[3, 24], [9, 22], [14, 24], [20, 22], [26, 25], [32, 23]], "water", 1);
  g.ribbon([[8, 4], [10, 10], [9, 16], [12, 22]], "water");
  g.blob(30, 16, 4, 5, "water", 0.85);

  // dry grass hummocks where the land lifts out of the bog
  g.clusters([[6, 18], [16, 12], [22, 18], [28, 10], [13, 28]], 3, "grass", 0.55, "swamp");
  // drowned-forest thickets
  g.clusters([[11, 7], [24, 28], [30, 26], [18, 6]], 2, "forest", 0.6, "swamp");
  // mossy boulders
  g.clusters([[20, 14], [9, 12]], 2, "rock", 0.5, "swamp");

  // a raised plank causeway (dry dirt) from the keep to the Mire fortress
  g.ribbon([[6, 19], [10, 18], [14, 16], [17, 14], [20, 12], [24, 10], [28, 8], [30, 7]], "dirt");

  const guard = (s: { id: import("./creatures").CreatureId; count: number }[]) => s;

  // ---- player's fortified landing ----
  const castle = g.place({
    type: "castle", x: 5, y: 18, owner: "player",
    name: FACTIONS[playerFaction].townName, faction: playerFaction,
  });
  for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [1, -1]]) g.clear(5 + dx, 18 + dy);

  // ---- story NPCs ----
  // Mosswife Hagar, a bog-witch at the gate — the chapter's hub.
  g.place({ type: "npc", x: 7, y: 19, npcId: "witch", name: "Mosswife Hagar" });
  // Quill the Ferryman poles the central channels — the chapter's guide.
  g.place({ type: "npc", x: 16, y: 13, npcId: "ferryman", name: "Quill the Ferryman" });
  // A bog-villager on a hummock: flavor and a small gift.
  g.place({ type: "npc", x: 22, y: 17, npcId: "frogman", name: "Old Squelch" });

  // The Sunken Idol on a far hummock — goal of the reach quest.
  g.place({
    type: "sign", x: MIRE_IDOL[0], y: MIRE_IDOL[1],
    text: "A moss-eaten idol leans in the reeds. Touch its cold brow and the coven's fen-wards gutter out.",
  });

  // ---- mines (guarded by bog-beasts) ----
  g.place({ type: "mine", x: 10, y: 26, owner: "neutral", mineKind: "wood",
    name: "Cypress Stand", guard: guard([{ id: "troglodyte", count: 12 }]) });
  g.place({ type: "mine", x: 12, y: 9, owner: "neutral", mineKind: "sulfur",
    name: "Sulfur Bog", guard: guard([{ id: "harpy", count: 8 }]) });
  g.place({ type: "mine", x: 27, y: 22, owner: "neutral", mineKind: "gold",
    name: "Drowned Vault", guard: guard([{ id: "ogre", count: 5 }]) });

  // ---- resources ----
  g.place({ type: "resource", x: 14, y: 16, resKind: "gold", amount: 1400 });
  g.place({ type: "resource", x: 8, y: 14, resKind: "wood", amount: 8 });
  g.place({ type: "resource", x: 24, y: 14, resKind: "sulfur", amount: 5 });
  g.place({ type: "resource", x: 30, y: 30, resKind: "gems", amount: 6 });
  g.place({ type: "resource", x: 18, y: 24, resKind: "mercury", amount: 5 });

  // ---- chests ----
  g.place({ type: "chest", x: 22, y: 9, amount: 2000 });
  g.place({ type: "chest", x: 13, y: 24, amount: 1600 });

  // ---- roaming monsters ----
  // The bog-troll warband (quest target l3_trolls).
  g.place({ type: "monster", x: 20, y: 19, owner: "neutral", questId: "l3_trolls",
    guard: guard([{ id: "troll", count: 5 }]), reward: { gold: 1000, sulfur: 3 } });
  g.place({ type: "monster", x: 13, y: 12, owner: "neutral",
    guard: guard([{ id: "harpy", count: 12 }]), reward: { gold: 600 } });
  g.place({ type: "monster", x: 25, y: 16, owner: "neutral",
    guard: guard([{ id: "gazer", count: 6 }]), reward: { mercury: 4 } });
  g.place({ type: "monster", x: 28, y: 11, owner: "neutral",
    guard: guard([{ id: "minotaur", count: 4 }, { id: "troglodyte", count: 10 }]), reward: { gold: 1100 } });

  // ---- decorative cypress / rocks ----
  for (const [x, y] of [[5, 22], [17, 9], [29, 18], [11, 30], [32, 14]]) g.prop(x, y, { type: "tree", variant: (x + y) % 2 });
  for (const [x, y] of [[19, 16], [9, 20], [26, 27]]) g.prop(x, y, { type: "rock" });

  // ---- the Mire fortress: chapter's stronghold (l3_mire) ----
  const eLine = FACTIONS[enemyFaction].lineup;
  const stronghold = g.place({
    type: "stronghold", x: 30, y: 6, owner: "enemy", questId: "l3_mire",
    name: `${FACTIONS[enemyFaction].townName} Mire`, faction: enemyFaction,
    guard: guard([{ id: eLine[5], count: 1 }, { id: eLine[4], count: 8 }, { id: eLine[3], count: 12 }]),
  });

  g.ensureReachable(6, 18);
  return { map: g.build(), castle, stronghold, startX: 6, startY: 18 };
}
