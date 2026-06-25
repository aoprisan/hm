// Army = up to 5 creature stacks. Stack helpers used by hero, town and combat.
import { CreatureId, CREATURES } from "../data/creatures";

export interface Stack {
  id: CreatureId;
  count: number;
}

export type Army = (Stack | null)[]; // fixed length 5

export const ARMY_SLOTS = 5;

export function emptyArmy(): Army {
  return [null, null, null, null, null];
}

export function makeArmy(stacks: Stack[]): Army {
  const a = emptyArmy();
  for (let i = 0; i < Math.min(stacks.length, ARMY_SLOTS); i++) a[i] = stacks[i];
  return a;
}

export function armyIsEmpty(army: Army): boolean {
  return army.every((s) => !s || s.count <= 0);
}

export function totalCount(army: Army): number {
  return army.reduce((n, s) => n + (s?.count ?? 0), 0);
}

// Rough "army power" for AI / display.
export function armyPower(army: Army): number {
  let p = 0;
  for (const s of army) {
    if (!s || s.count <= 0) continue;
    const c = CREATURES[s.id];
    const avgDmg = (c.dmgMin + c.dmgMax) / 2;
    p += s.count * (c.hp + (c.atk + c.def) * 1.5 + avgDmg * 3);
  }
  return Math.round(p);
}

// Add creatures to an army, merging into an existing same-type stack or a free slot.
// Returns false if there was no room.
export function addToArmy(army: Army, id: CreatureId, count: number): boolean {
  for (const s of army) {
    if (s && s.id === id) {
      s.count += count;
      return true;
    }
  }
  for (let i = 0; i < ARMY_SLOTS; i++) {
    if (!army[i]) {
      army[i] = { id, count };
      return true;
    }
  }
  return false;
}

export function cleanupArmy(army: Army): void {
  for (let i = 0; i < ARMY_SLOTS; i++) {
    const s = army[i];
    if (s && s.count <= 0) army[i] = null;
  }
}

// Move up to `count` creatures from `from[fromIdx]` into `to` (merging/finding a
// free slot). Returns false if the source slot is empty or `to` has no room.
export function transferStack(from: Army, fromIdx: number, to: Army, count: number): boolean {
  const s = from[fromIdx];
  if (!s || s.count <= 0) return false;
  const move = Math.max(0, Math.min(count, s.count));
  if (move <= 0) return false;
  if (!addToArmy(to, s.id, move)) return false; // no room in target — leave source untouched
  s.count -= move;
  cleanupArmy(from);
  return true;
}
