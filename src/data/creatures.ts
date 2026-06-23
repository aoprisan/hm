// Knight faction creature roster (HOMM2-style stats). Speed here is battlefield
// movement range in cells per turn. `shots` > 0 marks a ranged unit.
import { ResourceBag, bag } from "./resources";

export type CreatureId =
  | "peasant"
  | "archer"
  | "pikeman"
  | "swordsman"
  | "cavalry"
  | "paladin"
  // a few neutral creatures used for map guards / enemy
  | "goblin"
  | "wolf"
  | "ogre"
  | "troll"
  | "dragon";

export interface Creature {
  id: CreatureId;
  name: string;
  tier: number;
  atk: number;
  def: number;
  dmgMin: number;
  dmgMax: number;
  hp: number;
  speed: number; // battlefield cells / turn
  shots: number; // 0 = melee only
  growth: number; // weekly growth in a fully-built dwelling
  cost: ResourceBag; // recruit cost per unit
  neutral?: boolean;
}

export const CREATURES: Record<CreatureId, Creature> = {
  peasant: {
    id: "peasant", name: "Peasant", tier: 1,
    atk: 1, def: 1, dmgMin: 1, dmgMax: 1, hp: 1, speed: 2, shots: 0,
    growth: 12, cost: bag({ gold: 20 }),
  },
  archer: {
    id: "archer", name: "Archer", tier: 2,
    atk: 5, def: 3, dmgMin: 2, dmgMax: 3, hp: 10, speed: 4, shots: 12,
    growth: 8, cost: bag({ gold: 150 }),
  },
  pikeman: {
    id: "pikeman", name: "Pikeman", tier: 3,
    atk: 5, def: 9, dmgMin: 3, dmgMax: 4, hp: 15, speed: 4, shots: 0,
    growth: 5, cost: bag({ gold: 200 }),
  },
  swordsman: {
    id: "swordsman", name: "Swordsman", tier: 4,
    atk: 7, def: 9, dmgMin: 4, dmgMax: 6, hp: 25, speed: 5, shots: 0,
    growth: 4, cost: bag({ gold: 250 }),
  },
  cavalry: {
    id: "cavalry", name: "Cavalry", tier: 5,
    atk: 10, def: 9, dmgMin: 5, dmgMax: 10, hp: 30, speed: 7, shots: 0,
    growth: 3, cost: bag({ gold: 300 }),
  },
  paladin: {
    id: "paladin", name: "Paladin", tier: 6,
    atk: 11, def: 12, dmgMin: 10, dmgMax: 20, hp: 50, speed: 7, shots: 0,
    growth: 2, cost: bag({ gold: 600 }),
  },

  // ---- neutral creatures (map guards / enemy stronghold) ----
  goblin: {
    id: "goblin", name: "Goblin", tier: 1, neutral: true,
    atk: 3, def: 1, dmgMin: 1, dmgMax: 2, hp: 3, speed: 3, shots: 0,
    growth: 0, cost: bag({ gold: 40 }),
  },
  wolf: {
    id: "wolf", name: "Wolf", tier: 2, neutral: true,
    atk: 6, def: 2, dmgMin: 2, dmgMax: 3, hp: 10, speed: 6, shots: 0,
    growth: 0, cost: bag({ gold: 100 }),
  },
  ogre: {
    id: "ogre", name: "Ogre", tier: 3, neutral: true,
    atk: 9, def: 5, dmgMin: 3, dmgMax: 5, hp: 40, speed: 3, shots: 0,
    growth: 0, cost: bag({ gold: 200 }),
  },
  troll: {
    id: "troll", name: "Troll", tier: 4, neutral: true,
    atk: 10, def: 5, dmgMin: 5, dmgMax: 7, hp: 40, speed: 5, shots: 8,
    growth: 0, cost: bag({ gold: 300 }),
  },
  dragon: {
    id: "dragon", name: "Red Dragon", tier: 6, neutral: true,
    atk: 14, def: 14, dmgMin: 25, dmgMax: 50, hp: 180, speed: 8, shots: 0,
    growth: 0, cost: bag({ gold: 1500 }),
  },
};

// The 6 recruitable Knight tiers, in order.
export const KNIGHT_LINEUP: CreatureId[] = [
  "peasant", "archer", "pikeman", "swordsman", "cavalry", "paladin",
];
