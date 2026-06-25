// Central game state: world, hero, economy, town and win/lose status.
import { GameMap } from "./map";
import { Fog } from "./fog";
import { Hero } from "./hero";
import { Army, emptyArmy } from "./army";
import { ResourceBag, bag } from "../data/resources";
import { BuildingId } from "../data/buildings";
import { CreatureId } from "../data/creatures";
import { FactionId, FACTIONS } from "../data/factions";

export interface TownState {
  name: string;
  faction: FactionId; // which castle type — drives buildings, creatures and art
  built: Set<BuildingId>;
  builtToday: boolean;
  available: Partial<Record<CreatureId, number>>; // creatures waiting in dwellings
  garrison: Army; // creatures left to defend the town
  x: number; // map tile of the town
  y: number;
}

export type GamePhase = "playing" | "won" | "lost";

// Themed names for the seven days of the game week (day 1..7).
export const WEEKDAY_NAMES = [
  "Sunday", "Moonday", "Forgeday", "Wyrmday", "Thunderday", "Frostday", "Starday",
];

export class GameState {
  map: GameMap;
  fog: Fog;
  hero: Hero;
  resources: ResourceBag;
  day = 1; // total days, 1-based
  town: TownState;
  phase: GamePhase = "playing";
  log: string[] = [];

  constructor(map: GameMap, hero: Hero, town: TownState) {
    this.map = map;
    this.hero = hero;
    this.town = town;
    this.fog = new Fog(map.width, map.height);
    this.resources = bag({ gold: 3000, wood: 12, ore: 8 });
    this.fog.reveal(hero.x, hero.y, hero.scouting);
    this.fog.reveal(town.x, town.y, 3);
  }

  get week(): number {
    return Math.floor((this.day - 1) / 7) + 1;
  }
  get dayOfWeek(): number {
    return ((this.day - 1) % 7) + 1;
  }
  get dayName(): string {
    return WEEKDAY_NAMES[this.dayOfWeek - 1];
  }

  pushLog(msg: string): void {
    this.log.push(msg);
    if (this.log.length > 60) this.log.shift();
  }
}

export function freshTown(x: number, y: number, faction: FactionId, name?: string): TownState {
  const f = FACTIONS[faction];
  return {
    name: name ?? f.townName,
    faction,
    built: new Set<BuildingId>(["townHall", "dwelling1"]),
    builtToday: false,
    available: { [f.lineup[0]]: 12 }, // tier-1 dwelling starts stocked
    garrison: emptyArmy(),
    x,
    y,
  };
}
