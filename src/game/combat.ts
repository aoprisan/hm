// Simplified-tactical battle model (no spells/morale/luck). Square grid, 8-dir
// movement up to a unit's speed, melee with one retaliation, ranged shooting,
// turn order by speed, and a simple advance-and-attack enemy AI.
import { CREATURES, CreatureId } from "../data/creatures";
import { Stack } from "./army";
import { rng } from "./rng";

export const BW = 12; // battle grid width
export const BH = 9; // battle grid height
export const DEFEND_BONUS = 3; // defense added while a stack is defending

export type Side = "attacker" | "defender";

// Battlefield terrain features. Boulder/tree/crater are impassable cover;
// marsh is passable but costs extra movement (difficult terrain).
export type ObstacleKind = "boulder" | "tree" | "crater" | "marsh";

export const MARSH_COST = 2; // movement cost to enter a marsh cell

export function blocksMovement(k: ObstacleKind): boolean {
  return k !== "marsh";
}

export interface BattleUnit {
  side: Side;
  cid: CreatureId;
  count: number;
  hp: number; // current hp of the leading creature
  maxHp: number;
  x: number;
  y: number;
  atk: number; // creature.atk + hero bonus
  def: number;
  speed: number;
  shots: number; // remaining; 0 for melee units
  ranged: boolean;
  actedThisRound: boolean;
  retaliatedThisRound: boolean;
  defending: boolean; // chose Defend this round (+DEFEND_BONUS defense)
  waited: boolean; // chose Wait — acts later in the round
  slot: number; // original army slot, for stable ordering
}

export interface AttackResult {
  killed: number;
  damage: number;
}

// A non-randomized forecast of an attack, for the UI preview and the AI.
export interface DamageEstimate {
  dmgMin: number;
  dmgMax: number;
  killMin: number;
  killMax: number;
}

export class Battle {
  units: BattleUnit[] = [];
  round = 1;
  active: BattleUnit | null = null;
  winner: Side | null = null;
  features = new Map<number, ObstacleKind>(); // terrain features as y*BW+x -> kind

  constructor(
    attacker: (Stack | null)[],
    heroAtk: number,
    heroDef: number,
    defender: Stack[],
    enemyAtk: number,
    enemyDef: number,
  ) {
    this.placeSide(attacker, "attacker", heroAtk, heroDef, 0, 1);
    this.placeSide(defender, "defender", enemyAtk, enemyDef, BW - 1, BW - 2);
    this.scatterFeatures();
    this.startRound();
  }

  // Scatter a mix of terrain features across the central columns to create
  // lanes, chokepoints and difficult ground. Kept clear of the deployment
  // columns. Boulders/trees/craters block; marshes merely slow.
  private scatterFeatures(): void {
    // weighted bag — impassable cover is common, marsh patches less so
    const bag: ObstacleKind[] = [
      "boulder", "boulder", "boulder",
      "tree", "tree",
      "crater",
      "marsh", "marsh",
    ];
    const n = rng.int(5, 9);
    let guard = 0;
    while (this.features.size < n && guard++ < 300) {
      const x = rng.int(2, BW - 3);
      const y = rng.int(0, BH - 1);
      const k = y * BW + x;
      if (this.features.has(k)) continue;
      if (this.unitAt(x, y)) continue;
      this.features.set(k, bag[rng.int(0, bag.length - 1)]);
    }
  }

  featureAt(x: number, y: number): ObstacleKind | undefined {
    return this.features.get(y * BW + x);
  }

  // True if a stack cannot stand on / pass through this cell.
  isObstacle(x: number, y: number): boolean {
    const f = this.features.get(y * BW + x);
    return !!f && blocksMovement(f);
  }

  // Movement cost to enter a cell (difficult terrain costs more).
  private enterCost(x: number, y: number): number {
    return this.features.get(y * BW + x) === "marsh" ? MARSH_COST : 1;
  }

  private placeSide(
    army: (Stack | null)[],
    side: Side,
    atkBonus: number,
    defBonus: number,
    col0: number,
    col1: number,
  ): void {
    const stacks = army.filter((s): s is Stack => !!s && s.count > 0);
    const rows = layoutRows(stacks.length);
    stacks.forEach((s, i) => {
      const c = CREATURES[s.id];
      this.units.push({
        side,
        cid: s.id,
        count: s.count,
        hp: c.hp,
        maxHp: c.hp,
        x: i % 2 === 1 && stacks.length > 4 ? col1 : col0,
        y: rows[i],
        atk: c.atk + atkBonus,
        def: c.def + defBonus,
        speed: c.speed,
        shots: c.shots,
        ranged: c.shots > 0,
        actedThisRound: false,
        retaliatedThisRound: false,
        defending: false,
        waited: false,
        slot: i,
      });
    });
  }

  alive(side: Side): BattleUnit[] {
    return this.units.filter((u) => u.side === side && u.count > 0);
  }

  unitAt(x: number, y: number): BattleUnit | undefined {
    return this.units.find((u) => u.count > 0 && u.x === x && u.y === y);
  }

  startRound(): void {
    for (const u of this.units) {
      u.actedThisRound = false;
      u.retaliatedThisRound = false;
      u.defending = false;
      u.waited = false;
    }
    this.advance();
  }

  // The remaining turn order for this round: fast units first, then units that
  // chose to Wait (slowest of them act first, HOMM2-style). The head is active.
  private orderPending(): BattleUnit[] {
    const pending = this.units.filter((u) => u.count > 0 && !u.actedThisRound);
    const tie = (a: BattleUnit, b: BattleUnit) =>
      (a.side === "attacker" ? -1 : 1) - (b.side === "attacker" ? -1 : 1) || a.slot - b.slot;
    const normal = pending.filter((u) => !u.waited).sort((a, b) => b.speed - a.speed || tie(a, b));
    const waited = pending.filter((u) => u.waited).sort((a, b) => a.speed - b.speed || tie(a, b));
    return [...normal, ...waited];
  }

  // The next `limit` stacks to act (active first), for the initiative display.
  upcoming(limit = 10): BattleUnit[] {
    return this.orderPending().slice(0, limit);
  }

  // Move the pointer to the next living, not-yet-acted unit.
  advance(): void {
    if (this.checkWinner()) { this.active = null; return; }
    const pending = this.orderPending();
    if (pending.length === 0) {
      this.round++;
      this.startRound();
      return;
    }
    this.active = pending[0];
  }

  endActiveTurn(): void {
    if (this.active) this.active.actedThisRound = true;
    this.advance();
  }

  // Defend: skip acting but gain a defense bonus until this stack's next turn.
  defendActive(): void {
    if (this.active) {
      this.active.defending = true;
      this.active.actedThisRound = true;
    }
    this.advance();
  }

  // Wait: step aside and act later in the round (cannot wait twice).
  waitActive(): boolean {
    const u = this.active;
    if (!u || u.waited) return false;
    u.waited = true;
    this.advance();
    return true;
  }

  canWait(u: BattleUnit | null): boolean {
    return !!u && !u.waited && !u.actedThisRound;
  }

  checkWinner(): boolean {
    const a = this.alive("attacker").length;
    const d = this.alive("defender").length;
    if (a === 0) { this.winner = "defender"; return true; }
    if (d === 0) { this.winner = "attacker"; return true; }
    return false;
  }

  // --- movement ---
  // Cost-aware flood (Dijkstra): diagonal 8-way steps cost 1, except entering a
  // marsh which costs MARSH_COST. Returns every cell reachable within `speed`.
  reachable(u: BattleUnit): Set<number> {
    const out = new Set<number>();
    const start = u.y * BW + u.x;
    const dist = new Map<number, number>([[start, 0]]);
    const visited = new Set<number>();
    while (true) {
      // pop the unvisited cell with the smallest accumulated cost
      let cur = -1, cd = Infinity;
      for (const [k, d] of dist) {
        if (!visited.has(k) && d < cd) { cd = d; cur = k; }
      }
      if (cur < 0) break;
      visited.add(cur);
      if (cd >= u.speed) continue;
      const cx = cur % BW, cy = Math.floor(cur / BW);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue;
          if (this.unitAt(nx, ny)) continue; // blocked by a unit
          if (this.isObstacle(nx, ny)) continue; // blocked by rock/tree/crater
          const nd = cd + this.enterCost(nx, ny);
          if (nd > u.speed) continue;
          const nk = ny * BW + nx;
          if (nd < (dist.get(nk) ?? Infinity)) { dist.set(nk, nd); out.add(nk); }
        }
      }
    }
    return out;
  }

  static adjacent(ax: number, ay: number, bx: number, by: number): boolean {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) === 1;
  }

  hasAdjacentEnemy(u: BattleUnit): boolean {
    return this.units.some(
      (e) => e.count > 0 && e.side !== u.side && Battle.adjacent(u.x, u.y, e.x, e.y),
    );
  }

  moveTo(u: BattleUnit, x: number, y: number): void {
    u.x = x;
    u.y = y;
  }

  // --- combat resolution ---
  private rollBaseDamage(u: BattleUnit): number {
    const c = CREATURES[u.cid];
    let total = 0;
    const n = Math.min(u.count, 100); // sample to avoid huge loops
    const scale = u.count / Math.max(1, n);
    for (let i = 0; i < n; i++) total += rng.int(c.dmgMin, c.dmgMax);
    return total * scale;
  }

  private multiplier(atk: number, def: number): number {
    if (atk >= def) return 1 + 0.1 * Math.min(atk - def, 30);
    return 1 / (1 + 0.05 * Math.min(def - atk, 14));
  }

  // Defense including the Defend stance bonus.
  effDef(u: BattleUnit): number {
    return u.def + (u.defending ? DEFEND_BONUS : 0);
  }

  // How many creatures a flat `dmg` would slay from `target`.
  private killsFor(target: BattleUnit, dmg: number): number {
    const pool = (target.count - 1) * target.maxHp + target.hp;
    if (dmg >= pool) return target.count;
    const remaining = pool - dmg;
    return target.count - Math.ceil(remaining / target.maxHp);
  }

  // Non-random forecast of an attack's damage and kill range (no retaliation).
  estimate(attacker: BattleUnit, target: BattleUnit): DamageEstimate {
    const c = CREATURES[attacker.cid];
    const mult = this.multiplier(attacker.atk, this.effDef(target));
    const lo = Math.max(1, Math.round(attacker.count * c.dmgMin * mult));
    const hi = Math.max(1, Math.round(attacker.count * c.dmgMax * mult));
    return {
      dmgMin: lo,
      dmgMax: hi,
      killMin: this.killsFor(target, lo),
      killMax: this.killsFor(target, hi),
    };
  }

  applyDamage(target: BattleUnit, rawDamage: number): AttackResult {
    const dmg = Math.max(1, Math.round(rawDamage));
    const before = target.count;
    const pool = (target.count - 1) * target.maxHp + target.hp;
    const remaining = pool - dmg;
    if (remaining <= 0) {
      target.count = 0;
      target.hp = 0;
    } else {
      const newCount = Math.ceil(remaining / target.maxHp);
      target.count = newCount;
      target.hp = remaining - (newCount - 1) * target.maxHp;
    }
    return { killed: before - target.count, damage: dmg };
  }

  // Perform an attack. isShot = ranged shot (no retaliation, consumes a shot).
  attack(attacker: BattleUnit, target: BattleUnit, isShot: boolean): { hit: AttackResult; retaliation?: AttackResult } {
    const base = this.rollBaseDamage(attacker);
    const mult = this.multiplier(attacker.atk, this.effDef(target));
    const hit = this.applyDamage(target, base * mult);
    if (isShot && attacker.shots > 0) attacker.shots--;
    let retaliation: AttackResult | undefined;
    if (!isShot && target.count > 0 && !target.retaliatedThisRound) {
      const rBase = this.rollBaseDamage(target);
      const rMult = this.multiplier(target.atk, this.effDef(attacker));
      retaliation = this.applyDamage(attacker, rBase * rMult);
      target.retaliatedThisRound = true;
    }
    return { hit, retaliation };
  }

  canShoot(u: BattleUnit): boolean {
    return u.ranged && u.shots > 0 && !this.hasAdjacentEnemy(u);
  }
}

// Spread stacks vertically across the battlefield.
function layoutRows(n: number): number[] {
  if (n <= 0) return [];
  const rows: number[] = [];
  const gap = (BH - 1) / (n + 1);
  for (let i = 0; i < n; i++) rows.push(Math.round(gap * (i + 1)));
  return rows;
}

// --- Enemy AI: returns an intended action for the active defender unit. ---
export type AiAction =
  | { kind: "shoot"; target: BattleUnit }
  | { kind: "attack"; target: BattleUnit; from: { x: number; y: number } }
  | { kind: "move"; to: { x: number; y: number } }
  | { kind: "wait" };

// How dangerous a stack is: total expected damage output, weighting shooters
// (they hurt from afar and take no retaliation) so the AI prioritizes them.
function threat(e: BattleUnit): number {
  const c = CREATURES[e.cid];
  const dps = e.count * ((c.dmgMin + c.dmgMax) / 2) * (1 + e.atk * 0.05);
  return dps * (e.ranged && e.shots > 0 ? 1.6 : 1);
}

// Score attacking `target` from the AI's perspective: prefer wiping out high
// threats, and prefer kills we can actually land (estimated damage vs. its hp).
function attackScore(battle: Battle, u: BattleUnit, target: BattleUnit): number {
  const est = battle.estimate(u, target);
  const avgKill = (est.killMin + est.killMax) / 2;
  return threat(target) * (1 + avgKill) + (est.dmgMin + est.dmgMax) / 2;
}

export function aiDecide(battle: Battle, u: BattleUnit): AiAction {
  const enemies = battle.units.filter((e) => e.count > 0 && e.side !== u.side);
  if (enemies.length === 0) return { kind: "wait" };

  // Shooters fire at the most dangerous enemy they can see (kills shooters fast).
  if (battle.canShoot(u)) {
    const target = enemies.reduce((a, b) => (attackScore(battle, u, b) > attackScore(battle, u, a) ? b : a));
    return { kind: "shoot", target };
  }

  // Already adjacent? Strike the best-scoring neighbor.
  const adj = enemies.filter((e) => Battle.adjacent(u.x, u.y, e.x, e.y));
  if (adj.length) {
    const target = adj.reduce((a, b) => (attackScore(battle, u, b) > attackScore(battle, u, a) ? b : a));
    return { kind: "attack", target, from: { x: u.x, y: u.y } };
  }

  // Otherwise advance: if a charge can reach an enemy this turn, take the most
  // valuable such strike; else close on the highest-threat foe (chasing shooters).
  const reach = battle.reachable(u);
  reach.add(u.y * BW + u.x);
  let bestAttack: { cell: number; target: BattleUnit; score: number } | null = null;
  for (const cell of reach) {
    const cx = cell % BW, cy = Math.floor(cell / BW);
    for (const e of enemies) {
      if (Math.max(Math.abs(cx - e.x), Math.abs(cy - e.y)) !== 1) continue;
      const score = attackScore(battle, u, e);
      if (!bestAttack || score > bestAttack.score) bestAttack = { cell, target: e, score };
    }
  }
  if (bestAttack) {
    return { kind: "attack", target: bestAttack.target, from: { x: bestAttack.cell % BW, y: Math.floor(bestAttack.cell / BW) } };
  }

  const prey = enemies.reduce((a, b) => (threat(b) > threat(a) ? b : a));
  let bestMoveCell = -1;
  let bestMoveDist = Infinity;
  for (const cell of reach) {
    const cx = cell % BW, cy = Math.floor(cell / BW);
    const approach = Math.hypot(cx - prey.x, cy - prey.y);
    if (approach < bestMoveDist) { bestMoveDist = approach; bestMoveCell = cell; }
  }
  if (bestMoveCell >= 0 && bestMoveCell !== u.y * BW + u.x) {
    return { kind: "move", to: { x: bestMoveCell % BW, y: Math.floor(bestMoveCell / BW) } };
  }
  return { kind: "wait" };
}
