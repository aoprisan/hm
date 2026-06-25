// Central game state: world, hero, economy, town and win/lose status.
import { GameMap } from "./map";
import { Fog } from "./fog";
import { Hero } from "./hero";
import { Army, emptyArmy } from "./army";
import { ResourceBag, bag, addBag } from "../data/resources";
import { BuildingId } from "../data/buildings";
import { CreatureId } from "../data/creatures";
import { FactionId, FACTIONS } from "../data/factions";
import { QUESTS, CHAPTERS, QuestEvent, QuestReward } from "../data/quests";
import { DialogueCondition } from "../data/dialogue";

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

// "cleared" is a transient between-chapters state: the current realm is won but
// the campaign continues — the scene shows an "Onward" screen that builds the
// next realm. "won" is reserved for clearing the campaign's final realm.
export type GamePhase = "playing" | "won" | "lost" | "cleared";

// The player's story progress: which quests are in flight / done, generic story
// flags set by dialogue, and the questIds of stacks already slain (so a chained
// quest whose target is already dead can complete instead of softlocking).
export interface QuestBook {
  active: string[];
  completed: string[];
}

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
  level = 0; // index into the campaign (which realm/chapter we're in)
  log: string[] = [];
  quests: QuestBook = { active: [], completed: [] };
  flags: Record<string, boolean> = {};
  slain: string[] = []; // questIds of tagged stacks already defeated
  // A one-shot intro line for the current realm, shown by the scene then cleared.
  // Transient (not persisted) — it only greets the player as a realm opens.
  banner: string | null = null;

  constructor(map: GameMap, hero: Hero, town: TownState, level = 0) {
    this.map = map;
    this.hero = hero;
    this.town = town;
    this.level = level;
    this.fog = new Fog(map.width, map.height);
    this.resources = bag({ gold: 3000, wood: 12, ore: 8 });
    this.fog.reveal(hero.x, hero.y, hero.scouting);
    this.fog.reveal(town.x, town.y, 3);
  }

  // The quest spine of the realm the player is currently in.
  get chapter(): string[] { return CHAPTERS[this.level] ?? []; }
  get isFinalLevel(): boolean { return this.level >= CHAPTERS.length - 1; }

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

  // ---------------- quests & story flags ----------------
  isQuestActive(id: string): boolean { return this.quests.active.includes(id); }
  isQuestComplete(id: string): boolean { return this.quests.completed.includes(id); }
  isQuestAvailable(id: string): boolean {
    return !this.isQuestActive(id) && !this.isQuestComplete(id);
  }
  hasFlag(flag: string): boolean { return !!this.flags[flag]; }
  setFlag(flag: string, value = true): void { this.flags[flag] = value; }

  startQuest(id: string): void {
    if (!QUESTS[id] || !this.isQuestAvailable(id)) return;
    this.quests.active.push(id);
    this.pushLog(`New quest — ${QUESTS[id].title}.`);
    // A chained quest whose target is already dead completes at once.
    const obj = QUESTS[id].objective;
    if (obj.kind === "slay" && this.slain.includes(obj.target)) this.completeQuest(id);
  }

  completeQuest(id: string): void {
    const i = this.quests.active.indexOf(id);
    if (i < 0) return;
    this.quests.active.splice(i, 1);
    this.quests.completed.push(id);
    const q = QUESTS[id];
    this.pushLog(`Quest complete — ${q.title}.`);
    if (q.reward) this.grantReward(q.reward);
    if (q.next) this.startQuest(q.next);
    // Clearing every quest in the current chapter ends the realm: the final
    // realm wins the campaign; any earlier one advances to the next.
    if (this.phase === "playing" && this.chapter.length &&
        this.chapter.every((qq) => this.isQuestComplete(qq))) {
      if (this.isFinalLevel) {
        this.phase = "won";
        this.pushLog("The Obsidian Throne falls. The shadow is lifted from every realm!");
      } else {
        this.phase = "cleared";
        this.pushLog("This realm is won. Press on — the road leads to a darker land.");
      }
    }
  }

  private grantReward(rw: QuestReward): void {
    if (rw.gold) this.resources.gold += rw.gold;
    if (rw.resources) addBag(this.resources, rw.resources);
    if (rw.exp) this.hero.gainExp(rw.exp);
    if (rw.flag) this.setFlag(rw.flag);
  }

  // Record a tagged stack's defeat and advance any quest waiting on it.
  recordSlain(target: string): void {
    if (!this.slain.includes(target)) this.slain.push(target);
    this.checkQuestProgress({ kind: "slay", target });
  }

  // Match a gameplay event against every active quest's objective.
  checkQuestProgress(ev: QuestEvent): void {
    for (const id of [...this.quests.active]) {
      const o = QUESTS[id]?.objective;
      if (!o) continue;
      if (ev.kind === "slay" && o.kind === "slay" && o.target === ev.target) this.completeQuest(id);
      else if (ev.kind === "reach" && o.kind === "reach" && o.x === ev.x && o.y === ev.y) this.completeQuest(id);
      else if (ev.kind === "talk" && o.kind === "talk" && o.npc === ev.npc) this.completeQuest(id);
    }
  }

  // Evaluate a dialogue gate against current story state.
  evalCondition(c: DialogueCondition): boolean {
    switch (c.kind) {
      case "questActive": return this.isQuestActive(c.quest);
      case "questComplete": return this.isQuestComplete(c.quest);
      case "questAvailable": return this.isQuestAvailable(c.quest);
      case "flag": return this.hasFlag(c.flag) === (c.value ?? true);
      case "hasArtifact": return false; // reserved for Phase 3
    }
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
