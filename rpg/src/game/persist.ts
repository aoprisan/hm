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
import { CAMPAIGN } from "../data/levels";

// The preview deployment ships from the same origin as the live game, so it
// would otherwise share this localStorage key. VITE_SAVE_SUFFIX (set only for
// the /preview/ build) namespaces it so testing can never clobber a real save.
const SUFFIX = (import.meta.env.VITE_SAVE_SUFFIX as string) ?? "";
// Legacy single-slot key (pre multi-slot). Migrated into a named slot on first
// access, then removed, so older saves are never lost.
const LEGACY_KEY = "realms-of-valor-save" + SUFFIX;
// Multi-slot storage: a lightweight index of slot metadata under INDEX_KEY plus
// one full SaveData blob per slot under SLOT_PREFIX + id. Splitting them keeps
// the menu's save list cheap to read without parsing every full run.
const INDEX_KEY = "realms-of-valor-slots" + SUFFIX;
const SLOT_PREFIX = "realms-of-valor-slot:" + SUFFIX;
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

// ----- multi-slot storage -----

// Lightweight per-slot summary shown in the load list. Derived from the full
// SaveData so the menu never has to parse every run to render the chooser.
export interface SlotMeta {
  id: string;
  name: string;
  savedAt: number; // epoch ms of the last write
  day: number;
  level: number; // campaign index
  realm: string; // realm name for that level
  heroName: string;
  faction: FactionId;
  phase: GameState["phase"];
}

const slotKey = (id: string): string => SLOT_PREFIX + id;

function readIndex(): SlotMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SlotMeta[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list: SlotMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    // ignore quota / private-mode failures
  }
}

function metaOf(id: string, name: string, savedAt: number, d: SaveData): SlotMeta {
  return {
    id, name, savedAt,
    day: d.day, level: d.level,
    realm: CAMPAIGN[d.level]?.name ?? `Realm ${d.level + 1}`,
    heroName: d.hero.name, faction: d.town.faction, phase: d.phase,
  };
}

// Fold any pre multi-slot save into a named slot exactly once, then drop the
// legacy key so it isn't migrated again.
function migrateLegacy(): void {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const d = JSON.parse(raw) as SaveData;
    if (d && d.version === SAVE_VERSION) {
      const id = newSlotId();
      const meta = metaOf(id, "Continued quest", Date.now(), d);
      localStorage.setItem(slotKey(id), raw);
      writeIndex([meta, ...readIndex()]);
    }
  } catch {
    // corrupt legacy save — nothing to migrate
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

// A new slot id. Time-based so ids sort roughly by creation; the random suffix
// avoids collisions when two runs start within the same millisecond.
export function newSlotId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// All saved runs, most-recently-saved first.
export function listSaves(): SlotMeta[] {
  migrateLegacy();
  return readIndex().slice().sort((a, b) => b.savedAt - a.savedAt);
}

export function mostRecentSave(): SlotMeta | null {
  return listSaves()[0] ?? null;
}

export function hasSave(): boolean {
  return listSaves().length > 0;
}

// Write (or overwrite) a named slot from the live game state.
export function saveSlot(id: string, name: string, s: GameState): void {
  try {
    const d = serialize(s);
    localStorage.setItem(slotKey(id), JSON.stringify(d));
    const meta = metaOf(id, name, Date.now(), d);
    const list = readIndex().filter((m) => m.id !== id);
    list.unshift(meta);
    writeIndex(list);
  } catch {
    // Ignore quota / private-mode failures — saving is best-effort.
  }
}

export function loadSlot(id: string): SaveData | null {
  try {
    const raw = localStorage.getItem(slotKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (!d || d.version !== SAVE_VERSION) return null;
    return d;
  } catch {
    return null;
  }
}

export function deleteSlot(id: string): void {
  try {
    localStorage.removeItem(slotKey(id));
    writeIndex(readIndex().filter((m) => m.id !== id));
  } catch {
    // ignore
  }
}
