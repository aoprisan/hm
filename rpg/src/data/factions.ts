// Faction descriptors. Each of the four castle types bundles its recruitable
// creature lineup, its six dwelling definitions (merged with the shared
// buildings into one lookup), a starting army / hero / town name, and an art
// palette that themes the town backdrop and adventure-map castle.
import { Building, BuildingId, DwellingSpec, buildFactionBuildings, BUILDING_ORDER } from "./buildings";
import {
  CreatureId, KNIGHT_LINEUP, SORCERESS_LINEUP, WARLOCK_LINEUP, NECROPOLIS_LINEUP,
} from "./creatures";

export type FactionId = "knight" | "sorceress" | "warlock" | "necropolis";

export interface FactionPalette {
  sky: [string, string];   // background gradient stops (top, bottom)
  ground: string;          // grassy ground base
  groundDetail: string;    // speckle / detail color on the ground
  mountain: string;        // distant range tint
  road: string;            // winding path color
  roofPrimary: string;     // shared-building roof / accent tint
  banner: string;          // castle flag/roof tint on the adventure map
}

export interface Faction {
  id: FactionId;
  name: string;            // town-type label shown in the menu
  blurb: string;           // one-line description for the menu card
  townName: string;        // default starting town name
  heroName: string;        // default starting hero name
  lineup: CreatureId[];    // the 6 recruitable tiers, 1..6
  startArmy: { id: CreatureId; count: number }[]; // hero's opening stacks
  buildings: Record<BuildingId, Building>;        // shared 7 + this faction's 6 dwellings
  order: BuildingId[];                            // build-menu order
  palette: FactionPalette;
}

const KNIGHT_DWELLINGS: DwellingSpec[] = [
  { name: "Thatched Hut", desc: "Recruit Peasants.", dwelling: "peasant" },
  { name: "Archery Range", desc: "Recruit Archers.", dwelling: "archer" },
  { name: "Blacksmith", desc: "Recruit Pikemen.", dwelling: "pikeman" },
  { name: "Armory", desc: "Recruit Swordsmen.", dwelling: "swordsman" },
  { name: "Jousting Arena", desc: "Recruit Cavalry.", dwelling: "cavalry" },
  { name: "Cathedral", desc: "Recruit holy Paladins.", dwelling: "paladin" },
];

const SORCERESS_DWELLINGS: DwellingSpec[] = [
  { name: "Faerie Glade", desc: "Recruit Sprites.", dwelling: "sprite" },
  { name: "Archers' Bower", desc: "Recruit Elf Archers.", dwelling: "elfArcher" },
  { name: "Druid Grove", desc: "Recruit Druids.", dwelling: "druid" },
  { name: "Unicorn Meadow", desc: "Recruit Unicorns.", dwelling: "unicorn" },
  { name: "Ancient Forest", desc: "Recruit Treants.", dwelling: "treant" },
  { name: "Phoenix Roost", desc: "Recruit fiery Phoenixes.", dwelling: "phoenix" },
];

const WARLOCK_DWELLINGS: DwellingSpec[] = [
  { name: "Warren", desc: "Recruit Troglodytes.", dwelling: "troglodyte" },
  { name: "Harpy Loft", desc: "Recruit Harpies.", dwelling: "harpy" },
  { name: "Pit of Eyes", desc: "Recruit Evil Eyes.", dwelling: "gazer" },
  { name: "Labyrinth", desc: "Recruit Minotaurs.", dwelling: "minotaur" },
  { name: "Manticore Lair", desc: "Recruit Manticores.", dwelling: "manticore" },
  { name: "Dragon Cave", desc: "Recruit dread Black Dragons.", dwelling: "blackDragon" },
];

const NECROPOLIS_DWELLINGS: DwellingSpec[] = [
  { name: "Cursed Graveyard", desc: "Recruit Skeletons.", dwelling: "skeleton" },
  { name: "Rotting Pit", desc: "Recruit Zombies.", dwelling: "zombie" },
  { name: "Haunted Mausoleum", desc: "Recruit Ghosts.", dwelling: "ghost" },
  { name: "Vampire Estate", desc: "Recruit Vampires.", dwelling: "vampire" },
  { name: "Dark Tower", desc: "Recruit Liches.", dwelling: "lich" },
  { name: "Bone Yard", desc: "Recruit Bone Dragons.", dwelling: "boneDragon" },
];

export const FACTIONS: Record<FactionId, Faction> = {
  knight: {
    id: "knight", name: "Castle",
    blurb: "Disciplined humans — sturdy infantry and holy paladins.",
    townName: "Sunhaven", heroName: "Sir Roland",
    lineup: KNIGHT_LINEUP,
    startArmy: [{ id: "peasant", count: 20 }, { id: "archer", count: 6 }],
    buildings: buildFactionBuildings(KNIGHT_DWELLINGS),
    order: BUILDING_ORDER,
    palette: {
      sky: ["#8ec5e8", "#cfe7f4"], ground: "#5b9a42", groundDetail: "#4f8a3a",
      mountain: "#7e9bb0", road: "#b3863f", roofPrimary: "#28548f", banner: "#3f78c8",
    },
  },
  sorceress: {
    id: "sorceress", name: "Rampart",
    blurb: "Fey and forest folk — swift sprites, archers and phoenixes.",
    townName: "Greenwood", heroName: "Lamanda",
    lineup: SORCERESS_LINEUP,
    startArmy: [{ id: "sprite", count: 16 }, { id: "elfArcher", count: 6 }],
    buildings: buildFactionBuildings(SORCERESS_DWELLINGS),
    order: BUILDING_ORDER,
    palette: {
      sky: ["#bfe3c8", "#e7f4e0"], ground: "#4f8a3a", groundDetail: "#3c6e2c",
      mountain: "#79a085", road: "#b9824a", roofPrimary: "#2f5a22", banner: "#79b85a",
    },
  },
  warlock: {
    id: "warlock", name: "Dungeon",
    blurb: "Subterranean monsters crowned by the dread Black Dragon.",
    townName: "Shadowdeep", heroName: "Mordax",
    lineup: WARLOCK_LINEUP,
    startArmy: [{ id: "troglodyte", count: 14 }, { id: "harpy", count: 6 }],
    buildings: buildFactionBuildings(WARLOCK_DWELLINGS),
    order: BUILDING_ORDER,
    palette: {
      sky: ["#3a2f4a", "#6a5a7a"], ground: "#5f574c", groundDetail: "#4a3f4a",
      mountain: "#4a4258", road: "#7a5a30", roofPrimary: "#7a3f9a", banner: "#c98ad8",
    },
  },
  necropolis: {
    id: "necropolis", name: "Necropolis",
    blurb: "An undead host that overwhelms with cheap, endless ranks.",
    townName: "Gravemoor", heroName: "Vossler",
    lineup: NECROPOLIS_LINEUP,
    startArmy: [{ id: "skeleton", count: 20 }, { id: "zombie", count: 5 }],
    buildings: buildFactionBuildings(NECROPOLIS_DWELLINGS),
    order: BUILDING_ORDER,
    palette: {
      sky: ["#8a8f99", "#c2c6cc"], ground: "#6b6b5c", groundDetail: "#57574a",
      mountain: "#6b645c", road: "#5b3a1a", roofPrimary: "#5f574c", banner: "#9b938a",
    },
  },
};

export const FACTION_ORDER: FactionId[] = ["knight", "sorceress", "warlock", "necropolis"];

// A faction distinct from `id` (used to give the enemy a different castle type).
export function otherFaction(id: FactionId): FactionId {
  const i = FACTION_ORDER.indexOf(id);
  return FACTION_ORDER[(i + 1) % FACTION_ORDER.length];
}

// Resolve faction-aware building lookups from a FactionId.
export function factionBuildings(id: FactionId): Record<BuildingId, Building> {
  return FACTIONS[id].buildings;
}
export function factionOrder(id: FactionId): BuildingId[] {
  return FACTIONS[id].order;
}
