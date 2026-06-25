// Quest definitions and the Chapter 1 story spine. A quest's objective is matched
// against gameplay events (talking to an NPC, slaying a tagged stack, reaching a
// tile); completing one grants its reward and chains into `next`. The game is won
// when every quest in CHAPTER1 is complete.
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
    title: "The Dark Lord's Keep",
    summary:
      "With the ward rekindled, the keep's protections are broken. Storm the enemy " +
      "stronghold to the northeast and end the shadow over Sunhaven for good.",
    giver: "sage",
    objective: { kind: "slay", target: "dark_lord" },
    reward: { exp: 300 },
  },
};

// The ordered spine of Chapter 1. The run is won when all of these are complete.
export const CHAPTER1: string[] = ["q_meet", "q_troll", "q_beacon", "q_keep"];
