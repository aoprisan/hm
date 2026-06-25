// Economy: daily income, weekly creature growth, building, recruiting, trading.
import { GameState } from "./state";
import { BuildingId } from "../data/buildings";
import { factionBuildings } from "../data/factions";
import { CREATURES, CreatureId } from "../data/creatures";
import {
  ResourceBag, ResourceKind, addBag, bag, canAfford, pay,
} from "../data/resources";
import { addToArmy, Army } from "./army";

// Per-day yield of an owned mine, by the resource it produces.
export function mineYield(kind: ResourceKind): Partial<ResourceBag> {
  switch (kind) {
    case "gold": return { gold: 1000 };
    case "wood": return { wood: 2 };
    case "ore": return { ore: 2 };
    default: return { [kind]: 1 } as Partial<ResourceBag>;
  }
}

export function dailyIncome(state: GameState): ResourceBag {
  const income = bag({});
  const B = factionBuildings(state.town.faction);
  for (const id of state.town.built) {
    const b = B[id];
    if (b.goldPerDay) income.gold += b.goldPerDay;
  }
  for (const o of state.map.objects) {
    if (o.type === "mine" && o.owner === "player" && o.mineKind) {
      addBag(income, mineYield(o.mineKind));
    }
  }
  return income;
}

function growthBonus(state: GameState): number {
  const B = factionBuildings(state.town.faction);
  let bonus = 0;
  for (const id of state.town.built) bonus += B[id].growthBonus ?? 0;
  return bonus;
}

export function applyWeeklyGrowth(state: GameState): void {
  const B = factionBuildings(state.town.faction);
  const bonus = growthBonus(state);
  for (const id of state.town.built) {
    const b = B[id];
    if (!b.dwelling) continue;
    const c = CREATURES[b.dwelling];
    const grow = c.growth + bonus;
    state.town.available[b.dwelling] = (state.town.available[b.dwelling] ?? 0) + grow;
  }
}

export function endTurn(state: GameState): void {
  state.day++;
  state.hero.resetMovement();
  state.town.builtToday = false;
  addBag(state.resources, dailyIncome(state));
  if (state.dayOfWeek === 1) {
    applyWeeklyGrowth(state);
    state.pushLog(`Week ${state.week} dawns. New recruits gather in the dwellings.`);
  }
}

// ---- Building ----
export function canBuild(state: GameState, id: BuildingId): { ok: boolean; reason?: string } {
  const B = factionBuildings(state.town.faction);
  const b = B[id];
  if (state.town.built.has(id)) return { ok: false, reason: "Already built" };
  if (state.town.builtToday) return { ok: false, reason: "Already built today" };
  for (const p of b.prereq) {
    if (!state.town.built.has(p)) return { ok: false, reason: `Requires ${B[p].name}` };
  }
  if (!canAfford(state.resources, b.cost)) return { ok: false, reason: "Not enough resources" };
  return { ok: true };
}

export function build(state: GameState, id: BuildingId): boolean {
  if (!canBuild(state, id).ok) return false;
  const b = factionBuildings(state.town.faction)[id];
  pay(state.resources, b.cost);
  state.town.built.add(id);
  state.town.builtToday = true;
  // newly built dwellings come with their first week's recruits
  if (b.dwelling) {
    const c = CREATURES[b.dwelling];
    state.town.available[b.dwelling] = (state.town.available[b.dwelling] ?? 0) + c.growth;
  }
  state.pushLog(`Built the ${b.name}.`);
  return true;
}

// ---- Recruiting ----
export function maxAffordable(state: GameState, id: CreatureId): number {
  const c = CREATURES[id];
  const avail = state.town.available[id] ?? 0;
  let n = avail;
  for (const k of Object.keys(c.cost) as ResourceKind[]) {
    const per = c.cost[k];
    if (per > 0) n = Math.min(n, Math.floor(state.resources[k] / per));
  }
  return Math.max(0, n);
}

export function recruit(state: GameState, id: CreatureId, count: number, target: Army): boolean {
  const c = CREATURES[id];
  const avail = state.town.available[id] ?? 0;
  count = Math.min(count, avail, maxAffordable(state, id));
  if (count <= 0) return false;
  const total: Partial<ResourceBag> = {};
  for (const k of Object.keys(c.cost) as ResourceKind[]) total[k] = c.cost[k] * count;
  if (!canAfford(state.resources, total)) return false;
  if (!addToArmy(target, id, count)) return false;
  pay(state.resources, total);
  state.town.available[id] = avail - count;
  state.pushLog(`Recruited ${count} ${c.name}${count > 1 ? "s" : ""}.`);
  return true;
}

// ---- Marketplace trading (sell resources for gold) ----
export const SELL_RATE: Record<ResourceKind, number> = {
  wood: 50, ore: 50, mercury: 100, sulfur: 100, crystal: 100, gems: 100, gold: 1,
};

export function sellResource(state: GameState, kind: ResourceKind, amount: number): boolean {
  if (kind === "gold") return false;
  if (state.resources[kind] < amount || amount <= 0) return false;
  state.resources[kind] -= amount;
  state.resources.gold += amount * SELL_RATE[kind];
  return true;
}
