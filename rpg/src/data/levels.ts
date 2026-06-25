// The campaign: an ordered list of realms the hero crosses, each with its own
// land, foe and four-quest chapter. The hero (army, level, stats) and the war
// chest carry forward from realm to realm; clearing the final realm wins the war.
import { BuiltLevel } from "./mapgen";
import { buildMap1 } from "./map1";
import { buildMap2 } from "./map2";
import { buildMap3 } from "./map3";
import { buildMap4 } from "./map4";
import { buildMap5 } from "./map5";
import { FactionId, otherFaction } from "./factions";
import { CHAPTERS } from "./quests";

export interface LevelDef {
  id: string;
  name: string;          // realm name (shown in banners / end screens)
  realm: string;         // one-line land description
  intro: string;         // shown when the realm begins
  outro: string;         // shown when the realm is cleared
  enemy: FactionId;      // preferred enemy castle type for the stronghold
  chapter: string[];     // this realm's quest spine (from CHAPTERS)
  build: (player: FactionId, enemy: FactionId) => BuiltLevel;
}

export const CAMPAIGN: LevelDef[] = [
  {
    id: "sunhaven",
    name: "The Vale of Sunhaven",
    realm: "Green grassland, lakes and forest.",
    intro:
      "Chapter I — The Vale of Sunhaven.\n\nYour home valley, green and golden, but a cold " +
      "shadow gathers in the northeast. Speak with Elder Aldous by the castle gate to begin.",
    outro:
      "The Vale of Sunhaven is safe — but the shadow only fled north, to colder country. " +
      "Gather your army; the road climbs on into the snow.",
    enemy: "necropolis",
    chapter: CHAPTERS[0],
    build: buildMap1,
  },
  {
    id: "frostmere",
    name: "Frostmere Reach",
    realm: "Frozen snowfields, a cracked ice lake and black pine.",
    intro:
      "Chapter II — Frostmere Reach.\n\nA frozen north of deep snow and glacier ice, where the " +
      "dead climb from a buried barrow. Brother Caedmon waits by the gate. Mind the thin blue ice.",
    outro:
      "The Barrow-King lies still beneath clean snow. But the frost-cold flowed from somewhere " +
      "hotter and fouler — a drowned marsh festering to the south.",
    enemy: "necropolis",
    chapter: CHAPTERS[1],
    build: buildMap2,
  },
  {
    id: "sundermarsh",
    name: "The Sunder Marsh",
    realm: "Drowned fen of swamp, water channels and dead forest.",
    intro:
      "Chapter III — The Sunder Marsh.\n\nA reeking mire of stagnant water and sucking bog, worked " +
      "by a hidden coven. Mosswife Hagar greets you at the gate. Keep to the dry hummocks and causeways.",
    outro:
      "The coven's Mire fortress is drained and silent. But its masters answered to a power in the " +
      "burning east — a wasteland of fire and dragons.",
    enemy: "warlock",
    chapter: CHAPTERS[2],
    build: buildMap3,
  },
  {
    id: "emberwastes",
    name: "The Emberwastes",
    realm: "Volcanic ashland, molten lava lakes and black rock.",
    intro:
      "Chapter IV — The Emberwastes.\n\nA volcanic hell of scorched ash and molten lava, ruled by " +
      "roosting dragon-lords. Pyra the Emberseer reads the lava-tides at the gate. Lava is death — " +
      "thread the grey ash between the lakes.",
    outro:
      "The Cinder Spire is cast down and the dragon-fire gutters out. Only one shadow remains — the " +
      "Dark Lord himself, upon the Obsidian Throne in the Shadowmarch.",
    enemy: "warlock",
    chapter: CHAPTERS[3],
    build: buildMap4,
  },
  {
    id: "shadowmarch",
    name: "The Shadowmarch",
    realm: "The Dark Lord's blighted realm — every blight gathered into one.",
    intro:
      "Chapter V — The Shadowmarch.\n\nThe Dark Lord's own realm, where ash, frost, mire and lava " +
      "meet around the Obsidian Throne behind a black moat. The Last Oracle awaits. This is the end " +
      "of the road — and of the shadow, if you can reach the Throne.",
    outro:
      "The Obsidian Throne is broken and the Dark Lord is no more. Every realm wakes free of the shadow.",
    enemy: "necropolis",
    chapter: CHAPTERS[4],
    build: buildMap5,
  },
];

// Resolve a realm's actual enemy faction, never matching the player's own so the
// stronghold always contrasts the player's castle.
export function levelEnemy(level: number, player: FactionId): FactionId {
  const pref = CAMPAIGN[level]?.enemy ?? "necropolis";
  return pref === player ? otherFaction(player) : pref;
}

export const FINAL_LEVEL = CAMPAIGN.length - 1;
