// Chapter 5 — "The Shadowmarch": the Dark Lord's own blighted realm and the
// campaign's finale. Every blight of the journey meets here — ashen wastes, dead
// forest, a black-water moat, lava seams and a frost-bitten northern rise —
// gathered around the Obsidian Throne. Taking the Throne ends the war.
import { MapGrid, BuiltLevel } from "./mapgen";
import { FactionId, FACTIONS } from "./factions";

export const SHADOW_GATE: [number, number] = [27, 6]; // reach-quest target

export function buildMap5(playerFaction: FactionId, enemyFaction: FactionId): BuiltLevel {
  const W = 36, H = 36;
  const g = new MapGrid(W, H, "ash", 0x70d0a113, "ash");

  // a frost-bitten northern band and a black mountain rim
  g.border("mountain", 0.55);
  for (let y = 0; y < 5; y++) for (let x = 0; x < W; x++) if (g.rnd() < 0.5 - y * 0.08) g.set(x, y, "snow");

  // a moat of black water guarding the throne, with a single dark causeway
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - 26) / 8, dy = (y - 16) / 9;
      if (dx * dx + dy * dy < 1) g.set(x, y, "water");
    }
  }
  g.ribbon([[18, 16], [22, 14], [25, 11], [27, 8]], "dirt"); // causeway to the throne

  // lava seams bleeding through the waste
  g.blob(13, 24, 4, 3, "lava", 0.85);
  g.blob(9, 12, 3, 2, "lava", 0.85);

  // dead forest and shattered rock
  g.clusters([[8, 26], [16, 9], [11, 18], [31, 26]], 3, "forest", 0.55, "ash");
  g.clusters([[20, 22], [14, 13], [30, 12]], 2, "rock", 0.55, "ash");

  // wraith-ridges that channel the final approach (with gaps)
  for (let y = 8; y <= 15; y++) if (y !== 12) g.set(17, y, "rock");
  for (let x = 8; x <= 14; x++) if (x !== 11) g.set(x, 21, "rock");

  // the doom-road from the keep to the Obsidian Throne
  g.ribbon([[6, 18], [10, 17], [13, 15], [16, 13], [18, 16], [22, 14], [25, 11], [28, 7], [30, 5]], "dirt");

  const guard = (s: { id: import("./creatures").CreatureId; count: number }[]) => s;

  // ---- the last free citadel ----
  const castle = g.place({
    type: "castle", x: 5, y: 18, owner: "player",
    name: FACTIONS[playerFaction].townName, faction: playerFaction,
  });
  for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [1, -1]]) g.clear(5 + dx, 18 + dy);

  // ---- story NPCs ----
  // The Last Oracle waits at the gate — the chapter's hub.
  g.place({ type: "npc", x: 7, y: 19, npcId: "oracle", name: "The Last Oracle" });
  // The Gravewarden walks the middle waste — the chapter's guide.
  g.place({ type: "npc", x: 15, y: 14, npcId: "warden", name: "Gravewarden Sela" });
  // A spectral knight, sworn to aid: flavor and a parting gift.
  g.place({ type: "npc", x: 20, y: 15, npcId: "ghostKnight", name: "Sir Edran's Shade" });

  // The Shadow Gate before the throne-bridge — goal of the reach quest.
  g.place({
    type: "sign", x: SHADOW_GATE[0], y: SHADOW_GATE[1],
    text: "The Shadow Gate, sealed in seven sigils. As you near, the last sigil cracks — the throne lies open.",
  });

  // ---- mines (held by the Dark Lord's host) ----
  g.place({ type: "mine", x: 9, y: 25, owner: "neutral", mineKind: "ore",
    name: "Bone Quarry", guard: guard([{ id: "skeleton", count: 24 }]) });
  g.place({ type: "mine", x: 12, y: 8, owner: "neutral", mineKind: "gold",
    name: "Cursed Treasury", guard: guard([{ id: "vampire", count: 6 }]) });
  g.place({ type: "mine", x: 31, y: 28, owner: "neutral", mineKind: "gems",
    name: "Soulgem Lode", guard: guard([{ id: "lich", count: 5 }]) });

  // ---- resources ----
  g.place({ type: "resource", x: 13, y: 16, resKind: "gold", amount: 2000 });
  g.place({ type: "resource", x: 8, y: 21, resKind: "ore", amount: 10 });
  g.place({ type: "resource", x: 19, y: 11, resKind: "crystal", amount: 7 });
  g.place({ type: "resource", x: 32, y: 20, resKind: "gems", amount: 7 });
  g.place({ type: "resource", x: 23, y: 24, resKind: "mercury", amount: 6 });
  g.place({ type: "resource", x: 16, y: 27, resKind: "sulfur", amount: 6 });

  // ---- chests ----
  g.place({ type: "chest", x: 20, y: 9, amount: 3000 });
  g.place({ type: "chest", x: 14, y: 19, amount: 2200 });

  // ---- roaming monsters ----
  // The Death-Wight champion (quest target l5_wight).
  g.place({ type: "monster", x: 16, y: 16, owner: "neutral", questId: "l5_wight",
    guard: guard([{ id: "lich", count: 6 }, { id: "vampire", count: 5 }]), reward: { gold: 2000, crystal: 4 } });
  g.place({ type: "monster", x: 11, y: 13, owner: "neutral",
    guard: guard([{ id: "vampire", count: 8 }]), reward: { gold: 1000 } });
  g.place({ type: "monster", x: 22, y: 19, owner: "neutral",
    guard: guard([{ id: "boneDragon", count: 1 }]), reward: { gems: 5 } });
  g.place({ type: "monster", x: 16, y: 20, owner: "neutral",
    guard: guard([{ id: "lich", count: 7 }, { id: "skeleton", count: 20 }]), reward: { gold: 1600 } });

  // ---- decorative dead trees / rocks ----
  for (const [x, y] of [[10, 19], [18, 8], [29, 22], [7, 27], [33, 16]]) g.prop(x, y, { type: "tree", variant: (x + y) % 2 });
  for (const [x, y] of [[21, 16], [13, 12], [27, 24]]) g.prop(x, y, { type: "rock" });

  // ---- the Obsidian Throne: the campaign's final stronghold (l5_throne) ----
  const eLine = FACTIONS[enemyFaction].lineup;
  const stronghold = g.place({
    type: "stronghold", x: 30, y: 5, owner: "enemy", questId: "l5_throne",
    name: "The Obsidian Throne", faction: enemyFaction,
    guard: guard([{ id: eLine[5], count: 3 }, { id: eLine[4], count: 10 }, { id: eLine[3], count: 16 }]),
  });

  g.ensureReachable(6, 18);
  return { map: g.build(), castle, stronghold, startX: 6, startY: 18 };
}
