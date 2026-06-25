// Save / load the full run to localStorage so it survives a page reload. The
// map (terrain + objects) and fog are captured wholesale rather than
// regenerated, so the restored world matches the saved one exactly.
import { GameState, TownState, QuestBook } from "./state";
import { GameMap, MapObject } from "./map";
import { Hero } from "./hero";
import { Army } from "./army";
import { ResourceBag } from "../data/resources";
import { TerrainKind } from "../data/terrain";
import { FactionId } from "../data/factions";
import { CreatureId } from "../data/creatures";
import { BuildingId } from "../data/buildings";
import { SpellId } from "../data/spells";

// The preview deployment ships from the same origin as the live game, so it
// would otherwise share this localStorage key. VITE_SAVE_SUFFIX (set only for
// the /preview/ build) namespaces it so testing can never clobber a real save.
const SAVE_KEY =
  "realms-of-valor-save" + ((import.meta.env.VITE_SAVE_SUFFIX as string) ?? "");
// Bump when the save shape changes incompatibly; older saves are then ignored.
// v3 adds the quest book, story flags and slain-target list.
// v4 adds the campaign level index (multi-realm campaign).
const SAVE_VERSION = 4;

interface HeroSave {
  name: string; x: number; y: number; fx: number; fy: number; facing: 1 | -1;
  attack: number; defense: number; scouting: number; level: number; experience: number;
  movePoints: number; maxMovePoints: number; mana: number; maxMana: number;
  spells: SpellId[];
  army: Army;
}
interface TownSave {
  name: string; faction: FactionId; x: number; y: number; builtToday: boolean;
  built: BuildingId[]; available: Partial<Record<CreatureId, number>>; garrison: Army;
}
export interface SaveData {
  version: number;
  day: number; level: number; phase: GameState["phase"]; log: string[]; resources: ResourceBag;
  map: { width: number; height: number; tiles: TerrainKind[]; objects: MapObject[] };
  fog: number[];
  hero: HeroSave;
  town: TownSave;
  quests: QuestBook;
  flags: Record<string, boolean>;
  slain: string[];
}

export function serialize(s: GameState): SaveData {
  const h = s.hero;
  return {
    version: SAVE_VERSION,
    day: s.day, level: s.level, phase: s.phase, log: s.log.slice(), resources: { ...s.resources },
    map: {
      width: s.map.width, height: s.map.height,
      tiles: s.map.tiles.slice(), objects: s.map.objects,
    },
    fog: Array.from(s.fog.revealed),
    hero: {
      name: h.name, x: h.x, y: h.y, fx: h.fx, fy: h.fy, facing: h.facing,
      attack: h.attack, defense: h.defense, scouting: h.scouting,
      level: h.level, experience: h.experience,
      movePoints: h.movePoints, maxMovePoints: h.maxMovePoints,
      mana: h.mana, maxMana: h.maxMana, spells: h.spells.slice(), army: h.army,
    },
    town: {
      name: s.town.name, faction: s.town.faction, x: s.town.x, y: s.town.y,
      builtToday: s.town.builtToday, built: [...s.town.built],
      available: { ...s.town.available }, garrison: s.town.garrison,
    },
    quests: { active: s.quests.active.slice(), completed: s.quests.completed.slice() },
    flags: { ...s.flags },
    slain: s.slain.slice(),
  };
}

export function deserialize(d: SaveData): GameState {
  const map = new GameMap(d.map.width, d.map.height, d.map.tiles, d.map.objects);

  const hd = d.hero;
  const hero = new Hero(hd.name, hd.x, hd.y, [], hd.attack, hd.defense);
  hero.fx = hd.fx; hero.fy = hd.fy; hero.facing = hd.facing;
  hero.scouting = hd.scouting; hero.level = hd.level; hero.experience = hd.experience;
  hero.movePoints = hd.movePoints; hero.maxMovePoints = hd.maxMovePoints;
  hero.mana = hd.mana ?? hero.mana; hero.maxMana = hd.maxMana ?? hero.maxMana;
  hero.spells = hd.spells ?? [];
  hero.army = hd.army;

  const town: TownState = {
    name: d.town.name, faction: d.town.faction, x: d.town.x, y: d.town.y,
    built: new Set(d.town.built), builtToday: d.town.builtToday,
    available: d.town.available, garrison: d.town.garrison,
  };

  // The constructor seeds default resources and reveals starting fog; we then
  // overwrite those with the saved values.
  const state = new GameState(map, hero, town, d.level ?? 0);
  state.day = d.day;
  state.phase = d.phase;
  state.log = d.log;
  state.resources = d.resources;
  state.fog.revealed.set(d.fog);
  // Default defensively so a save missing these fields still loads cleanly.
  state.quests = d.quests ?? { active: [], completed: [] };
  state.flags = d.flags ?? {};
  state.slain = d.slain ?? [];
  return state;
}

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(s)));
  } catch {
    // Ignore quota / private-mode failures — saving is best-effort.
  }
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (!d || d.version !== SAVE_VERSION) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function hasSave(): boolean {
  return loadSave() !== null;
}
