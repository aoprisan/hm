// Quest definitions and the campaign's story spine. A quest's objective is matched
// against gameplay events (talking to an NPC, slaying a tagged stack, reaching a
// tile); completing one grants its reward and chains into `next`. Each realm has
// its own four-quest chapter (meet → hunt → reach → storm-the-keep); clearing a
// chapter's last quest advances the campaign, and clearing the final chapter wins.
import { ResourceKind } from "./resources";

export type QuestObjective =
  | { kind: "talk"; npc: string }            // talk to NPC `npc`
  | { kind: "slay"; target: string }         // defeat the map object whose questId === target
  | { kind: "reach"; x: number; y: number }; // stand on tile (x,y)

export interface QuestReward {
  gold?: number;
  resources?: Partial<Record<ResourceKind, number>>;
  exp?: number;
  flag?: string;       // a story flag set on completion
  artifact?: string;   // reserved for Phase 3
  skillPoint?: number; // reserved for Phase 2
}

export interface QuestDef {
  id: string;
  title: string;
  summary: string;       // shown in the quest log
  giver: string;         // npcId who originates this quest (drives map markers)
  objective: QuestObjective;
  reward?: QuestReward;
  next?: string;         // quest that auto-starts on completion (the chain)
}

// Gameplay events fed to GameState.checkQuestProgress.
export type QuestEvent =
  | { kind: "talk"; npc: string }
  | { kind: "slay"; target: string }
  | { kind: "reach"; x: number; y: number };

export const QUESTS: Record<string, QuestDef> = {
  // ============================================================
  // Chapter 1 — The Vale of Sunhaven (grassland)
  // ============================================================
  q_meet: {
    id: "q_meet",
    title: "Omens in the Vale",
    summary:
      "Elder Aldous fears a shadow over Sunhaven. Seek the seer Mirelle, who keeps " +
      "a watch along the eastern road, and hear what the omens foretell.",
    giver: "elder",
    objective: { kind: "talk", npc: "sage" },
    reward: { gold: 600, exp: 80 },
    next: "q_troll",
  },
  q_troll: {
    id: "q_troll",
    title: "The Troll of Thornwood",
    summary:
      "Mirelle warns of a dire troll that has crawled from Thornwood to prey on the " +
      "valley folk. Hunt it down in the eastern wilds and lay it low.",
    giver: "sage",
    objective: { kind: "slay", target: "troll_menace" },
    reward: { gold: 1200, resources: { crystal: 2 }, exp: 150 },
    next: "q_beacon",
  },
  q_beacon: {
    id: "q_beacon",
    title: "The Warding Beacon",
    summary:
      "An old watchtower on the northern rise once warded the valley with its beacon. " +
      "Climb to it and rekindle the ward before facing the dark lord's keep.",
    giver: "sage",
    objective: { kind: "reach", x: 24, y: 4 },
    reward: { gold: 800, exp: 120, flag: "wardKindled" },
    next: "q_keep",
  },
  q_keep: {
    id: "q_keep",
    title: "The Shadow Keep",
    summary:
      "With the ward rekindled, the keep's protections are broken. Storm the enemy " +
      "stronghold to the northeast and drive the shadow out of Sunhaven.",
    giver: "sage",
    objective: { kind: "slay", target: "dark_lord" },
    reward: { exp: 300 },
  },

  // ============================================================
  // Chapter 2 — Frostmere Reach (frozen north)
  // ============================================================
  l2_meet: {
    id: "l2_meet",
    title: "Cold Tidings",
    summary:
      "Brother Caedmon says the dead walk out of the glacier. Find Yetra the Trapper " +
      "on the central snowfields — none knows the frozen reach better than she.",
    giver: "monk",
    objective: { kind: "talk", npc: "trapper" },
    reward: { gold: 800, exp: 120 },
    next: "l2_pack",
  },
  l2_pack: {
    id: "l2_pack",
    title: "Hunters in the Snow",
    summary:
      "A pack of frost-wolves has been driven mad by the barrow-cold and hunts the " +
      "trails. Break the pack before it runs down Yetra's traplines.",
    giver: "trapper",
    objective: { kind: "slay", target: "l2_wolves" },
    reward: { gold: 1200, resources: { crystal: 3 }, exp: 200 },
    next: "l2_shrine",
  },
  l2_shrine: {
    id: "l2_shrine",
    title: "The Frostfont",
    summary:
      "An old frozen spring on the northern ice still holds warding-runes. Reach the " +
      "Frostfont and wake its meltwater to thaw the barrow's grip.",
    giver: "trapper",
    objective: { kind: "reach", x: 28, y: 6 },
    reward: { gold: 1000, exp: 180, flag: "frostfontWoken" },
    next: "l2_keep",
  },
  l2_keep: {
    id: "l2_keep",
    title: "The Barrow-King",
    summary:
      "With the Frostfont woken, the barrow's wards fail. Storm the undead Barrow to " +
      "the northeast and put the Barrow-King back in his ice.",
    giver: "trapper",
    objective: { kind: "slay", target: "l2_barrow" },
    reward: { gold: 600, exp: 350 },
  },

  // ============================================================
  // Chapter 3 — The Sunder Marsh (drowned fen)
  // ============================================================
  l3_meet: {
    id: "l3_meet",
    title: "Whispers in the Reeds",
    summary:
      "Mosswife Hagar smells coven-magic on the water. Seek Quill the Ferryman, who " +
      "poles the channels and knows every hummock in the mire.",
    giver: "witch",
    objective: { kind: "talk", npc: "ferryman" },
    reward: { gold: 900, exp: 150 },
    next: "l3_hunt",
  },
  l3_hunt: {
    id: "l3_hunt",
    title: "Bog-Troll Warband",
    summary:
      "A warband of bog-trolls the coven has raised is dragging folk into the muck. " +
      "Find them on the central hummocks and end them.",
    giver: "ferryman",
    objective: { kind: "slay", target: "l3_trolls" },
    reward: { gold: 1400, resources: { sulfur: 3 }, exp: 240 },
    next: "l3_idol",
  },
  l3_idol: {
    id: "l3_idol",
    title: "The Sunken Idol",
    summary:
      "The coven's fen-wards anchor to a moss-eaten idol on a far hummock. Reach it " +
      "and break the binding so the Mire fortress lies open.",
    giver: "ferryman",
    objective: { kind: "reach", x: 27, y: 7 },
    reward: { gold: 1200, exp: 220, flag: "idolBroken" },
    next: "l3_keep",
  },
  l3_keep: {
    id: "l3_keep",
    title: "The Mire Fortress",
    summary:
      "The fen-wards are broken. Storm the coven's Mire fortress in the northeast and " +
      "drain its dark magic from the marsh for good.",
    giver: "ferryman",
    objective: { kind: "slay", target: "l3_mire" },
    reward: { gold: 700, exp: 400 },
  },

  // ============================================================
  // Chapter 4 — The Emberwastes (volcanic hell)
  // ============================================================
  l4_meet: {
    id: "l4_meet",
    title: "Reading the Embers",
    summary:
      "Pyra the Emberseer warns the dragon-lords are roused. Find Cinder-Jack the " +
      "prospector out on the ash flats, who knows the safe lava-paths.",
    giver: "emberseer",
    objective: { kind: "talk", npc: "prospector" },
    reward: { gold: 1100, exp: 180 },
    next: "l4_hunt",
  },
  l4_hunt: {
    id: "l4_hunt",
    title: "The Fire-Drake",
    summary:
      "A fire-drake and its harpy flight have made the central flats a killing ground. " +
      "Bring the drake down before it razes the prospect camps.",
    giver: "prospector",
    objective: { kind: "slay", target: "l4_drake" },
    reward: { gold: 1800, resources: { sulfur: 4, mercury: 3 }, exp: 300 },
    next: "l4_forge",
  },
  l4_forge: {
    id: "l4_forge",
    title: "The Obsidian Forge",
    summary:
      "An old dwarf-forge on the high shelf can temper steel against dragonfire. Reach " +
      "the Obsidian Forge and quench your blades before the final climb.",
    giver: "prospector",
    objective: { kind: "reach", x: 29, y: 8 },
    reward: { gold: 1400, exp: 260, flag: "bladeTempered" },
    next: "l4_keep",
  },
  l4_keep: {
    id: "l4_keep",
    title: "The Cinder Spire",
    summary:
      "Tempered against the flame, climb to the Cinder Spire in the northeast and cast " +
      "down the dragon-lords who roost there.",
    giver: "prospector",
    objective: { kind: "slay", target: "l4_spire" },
    reward: { gold: 800, exp: 450 },
  },

  // ============================================================
  // Chapter 5 — The Shadowmarch (the finale)
  // ============================================================
  l5_meet: {
    id: "l5_meet",
    title: "The Last Oracle",
    summary:
      "The Last Oracle has seen the road's end. Seek Gravewarden Sela in the middle " +
      "waste; she has walked the Shadowmarch and lived.",
    giver: "oracle",
    objective: { kind: "talk", npc: "warden" },
    reward: { gold: 1500, exp: 240 },
    next: "l5_hunt",
  },
  l5_hunt: {
    id: "l5_hunt",
    title: "The Death-Wight",
    summary:
      "The Dark Lord's champion, a death-wight wreathed in liches, bars the waste. " +
      "Destroy it to clear the road to the throne-causeway.",
    giver: "warden",
    objective: { kind: "slay", target: "l5_wight" },
    reward: { gold: 2200, resources: { crystal: 4, gems: 3 }, exp: 400 },
    next: "l5_gate",
  },
  l5_gate: {
    id: "l5_gate",
    title: "The Shadow Gate",
    summary:
      "Seven sigils seal the Shadow Gate before the throne. Reach the gate and let the " +
      "wards of the whole campaign — beacon, font, idol, forge — shatter the last sigil.",
    giver: "warden",
    objective: { kind: "reach", x: 27, y: 6 },
    reward: { gold: 1800, exp: 360, flag: "gateOpened" },
    next: "l5_keep",
  },
  l5_keep: {
    id: "l5_keep",
    title: "The Obsidian Throne",
    summary:
      "The gate stands open. Cross the causeway, storm the Obsidian Throne, and end the " +
      "Dark Lord and his long shadow forever.",
    giver: "warden",
    objective: { kind: "slay", target: "l5_throne" },
    reward: { exp: 600 },
  },
};

// The ordered spine of each chapter. A chapter is cleared when all of its quests
// are complete; clearing the last chapter wins the campaign.
export const CHAPTERS: string[][] = [
  ["q_meet", "q_troll", "q_beacon", "q_keep"],
  ["l2_meet", "l2_pack", "l2_shrine", "l2_keep"],
  ["l3_meet", "l3_hunt", "l3_idol", "l3_keep"],
  ["l4_meet", "l4_hunt", "l4_forge", "l4_keep"],
  ["l5_meet", "l5_hunt", "l5_gate", "l5_keep"],
];

// Back-compat alias for the opening chapter.
export const CHAPTER1: string[] = CHAPTERS[0];
