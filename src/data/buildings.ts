// Castle build tree for the Knight town. Each building has a cost, prerequisites,
// and data-driven effects the economy/town logic reads (gold/day, growth bonus,
// or a dwelling that unlocks a creature for recruitment).
import { CreatureId } from "./creatures";
import { ResourceBag, bag } from "./resources";

export type BuildingId =
  | "townHall"
  | "statue"
  | "well"
  | "marketplace"
  | "tavern"
  | "mageGuild"
  | "castle"
  | "thatchedHut"
  | "archeryRange"
  | "blacksmith"
  | "armory"
  | "joustingArena"
  | "cathedral";

export interface Building {
  id: BuildingId;
  name: string;
  desc: string;
  cost: ResourceBag;
  prereq: BuildingId[];
  goldPerDay?: number;
  growthBonus?: number; // flat extra weekly growth to every dwelling
  enablesMarket?: boolean;
  // Anchor on the town background (virtual px of the town scene art region).
  anchor: { x: number; y: number };
  dwelling?: CreatureId; // if set, this is a creature dwelling
}

export const BUILDINGS: Record<BuildingId, Building> = {
  townHall: {
    id: "townHall", name: "Town Hall", desc: "Generates 500 gold each day.",
    cost: bag({ gold: 0 }), prereq: [], goldPerDay: 500, anchor: { x: 470, y: 210 },
  },
  statue: {
    id: "statue", name: "Statue", desc: "Adds 250 gold to your daily income.",
    cost: bag({ gold: 1250, ore: 5 }), prereq: ["townHall"], goldPerDay: 250, anchor: { x: 250, y: 360 },
  },
  well: {
    id: "well", name: "Well", desc: "Increases weekly creature growth in every dwelling.",
    cost: bag({ gold: 500 }), prereq: ["townHall"], growthBonus: 2, anchor: { x: 600, y: 360 },
  },
  marketplace: {
    id: "marketplace", name: "Marketplace", desc: "Trade resources for gold.",
    cost: bag({ gold: 500, wood: 5 }), prereq: ["townHall"], enablesMarket: true, anchor: { x: 150, y: 250 },
  },
  tavern: {
    id: "tavern", name: "Tavern", desc: "A cheerful inn that lifts the troops' spirits.",
    cost: bag({ gold: 500, wood: 5 }), prereq: ["townHall"], anchor: { x: 770, y: 250 },
  },
  mageGuild: {
    id: "mageGuild", name: "Mage Guild", desc: "Home of the town's wizards and scrolls.",
    cost: bag({ gold: 2000, wood: 5, ore: 5 }), prereq: ["townHall"], anchor: { x: 850, y: 380 },
  },
  castle: {
    id: "castle", name: "Castle", desc: "Mighty fortifications. Boosts creature growth.",
    cost: bag({ gold: 5000, wood: 20, ore: 20 }), prereq: ["townHall"], growthBonus: 1, anchor: { x: 470, y: 120 },
  },

  // ---- dwellings ----
  thatchedHut: {
    id: "thatchedHut", name: "Thatched Hut", desc: "Recruit Peasants.",
    cost: bag({ gold: 200 }), prereq: ["townHall"], dwelling: "peasant", anchor: { x: 110, y: 470 },
  },
  archeryRange: {
    id: "archeryRange", name: "Archery Range", desc: "Recruit Archers.",
    cost: bag({ gold: 1000, wood: 5 }), prereq: ["thatchedHut"], dwelling: "archer", anchor: { x: 270, y: 500 },
  },
  blacksmith: {
    id: "blacksmith", name: "Blacksmith", desc: "Recruit Pikemen.",
    cost: bag({ gold: 1000, wood: 5, ore: 5 }), prereq: ["archeryRange"], dwelling: "pikeman", anchor: { x: 430, y: 510 },
  },
  armory: {
    id: "armory", name: "Armory", desc: "Recruit Swordsmen.",
    cost: bag({ gold: 1500, wood: 10, ore: 10 }), prereq: ["blacksmith"], dwelling: "swordsman", anchor: { x: 590, y: 510 },
  },
  joustingArena: {
    id: "joustingArena", name: "Jousting Arena", desc: "Recruit Cavalry.",
    cost: bag({ gold: 3000, ore: 20 }), prereq: ["armory"], dwelling: "cavalry", anchor: { x: 750, y: 500 },
  },
  cathedral: {
    id: "cathedral", name: "Cathedral", desc: "Recruit holy Paladins.",
    cost: bag({ gold: 5000, wood: 20, ore: 20 }), prereq: ["joustingArena", "castle"], dwelling: "paladin", anchor: { x: 900, y: 470 },
  },
};

// Display order for the town build menu.
export const BUILDING_ORDER: BuildingId[] = [
  "castle", "statue", "well", "marketplace", "tavern", "mageGuild",
  "thatchedHut", "archeryRange", "blacksmith", "armory", "joustingArena", "cathedral",
];
