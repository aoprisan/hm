// Town build tree. The 7 non-dwelling buildings are faction-agnostic *roles*
// (townHall, statue, well, marketplace, tavern, mageGuild, castle) shared by
// every faction. The 6 dwellings are generic role ids (dwelling1..dwelling6)
// whose name/description/recruited-creature differ per faction; their cost,
// prerequisites and town-art anchor come from a shared template so every
// faction reuses the same six build slots. See data/factions.ts.
import { CreatureId } from "./creatures";
import { ResourceBag, bag } from "./resources";

export type SharedBuildingId =
  | "townHall"
  | "statue"
  | "well"
  | "marketplace"
  | "tavern"
  | "mageGuild"
  | "castle";

export type DwellingId =
  | "dwelling1"
  | "dwelling2"
  | "dwelling3"
  | "dwelling4"
  | "dwelling5"
  | "dwelling6";

export type BuildingId = SharedBuildingId | DwellingId;

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

// The 7 shared, faction-agnostic buildings.
export const SHARED_BUILDINGS: Record<SharedBuildingId, Building> = {
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
};

// Shared cost / prerequisite / anchor template for the six dwelling tiers. Each
// faction supplies only the per-tier name/desc/creature (see DwellingSpec).
interface DwellingTemplate { cost: ResourceBag; prereq: BuildingId[]; anchor: { x: number; y: number }; }
const DWELLING_TEMPLATE: DwellingTemplate[] = [
  { cost: bag({ gold: 200 }), prereq: ["townHall"], anchor: { x: 110, y: 470 } },
  { cost: bag({ gold: 1000, wood: 5 }), prereq: ["dwelling1"], anchor: { x: 270, y: 500 } },
  { cost: bag({ gold: 1000, wood: 5, ore: 5 }), prereq: ["dwelling2"], anchor: { x: 430, y: 510 } },
  { cost: bag({ gold: 1500, wood: 10, ore: 10 }), prereq: ["dwelling3"], anchor: { x: 590, y: 510 } },
  { cost: bag({ gold: 3000, ore: 20 }), prereq: ["dwelling4"], anchor: { x: 750, y: 500 } },
  { cost: bag({ gold: 5000, wood: 20, ore: 20 }), prereq: ["dwelling5", "castle"], anchor: { x: 900, y: 470 } },
];

export const DWELLING_ANCHORS = DWELLING_TEMPLATE.map((t) => t.anchor);
export const DWELLING_IDS: DwellingId[] = ["dwelling1", "dwelling2", "dwelling3", "dwelling4", "dwelling5", "dwelling6"];

// One per dwelling tier (tier 1..6), provided by each faction.
export interface DwellingSpec { name: string; desc: string; dwelling: CreatureId; }

// Merge the shared buildings with a faction's six dwellings into one lookup.
export function buildFactionBuildings(specs: DwellingSpec[]): Record<BuildingId, Building> {
  const out: Record<BuildingId, Building> = { ...SHARED_BUILDINGS } as Record<BuildingId, Building>;
  specs.forEach((s, i) => {
    const id = DWELLING_IDS[i];
    const t = DWELLING_TEMPLATE[i];
    out[id] = {
      id, name: s.name, desc: s.desc,
      cost: t.cost, prereq: t.prereq, anchor: t.anchor, dwelling: s.dwelling,
    };
  });
  return out;
}

// Display order for the town build menu (identical across factions since ids
// are generic roles).
export const BUILDING_ORDER: BuildingId[] = [
  "castle", "statue", "well", "marketplace", "tavern", "mageGuild",
  "dwelling1", "dwelling2", "dwelling3", "dwelling4", "dwelling5", "dwelling6",
];
