// Simplified-tactical battle model (no spells/morale/luck). Square grid, 8-dir
// movement up to a unit's speed, melee with one retaliation, ranged shooting,
// turn order by speed, and a simple advance-and-attack enemy AI.
import { CREATURES, CreatureId } from "../data/creatures";
import { Stack } from "./army";
import { rng } from "./rng";

export const BW = 12; // battle grid width
export const BH = 9; // battle grid height

export type Side = "attacker" | "defender";

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
  slot: number; // original army slot, for stable ordering
}

export interface AttackResult {
  killed: number;
  damage: number;
}

export class Battle {
  units: BattleUnit[] = [];
  round = 1;
  queue: BattleUnit[] = [];
  active: BattleUnit | null = null;
  winner: Side | null = null;

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
    this.startRound();
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
    }
    this.queue = this.units
      .filter((u) => u.count > 0)
      .sort((a, b) => b.speed - a.speed || (a.side === "attacker" ? -1 : 1) || a.slot - b.slot);
    this.advance();
  }

  // Move the pointer to the next living, not-yet-acted unit.
  advance(): void {
    if (this.checkWinner()) { this.active = null; return; }
    while (this.queue.length) {
      const u = this.queue.shift()!;
      if (u.count > 0 && !u.actedThisRound) {
        this.active = u;
        return;
      }
    }
    this.round++;
    this.startRound();
  }

  endActiveTurn(): void {
    if (this.active) this.active.actedThisRound = true;
    this.advance();
  }

  checkWinner(): boolean {
    const a = this.alive("attacker").length;
    const d = this.alive("defender").length;
    if (a === 0) { this.winner = "defender"; return true; }
    if (d === 0) { this.winner = "attacker"; return true; }
    return false;
  }

  // --- movement ---
  reachable(u: BattleUnit): Set<number> {
    const out = new Set<number>();
    const dist = new Map<number, number>();
    const start = u.y * BW + u.x;
    dist.set(start, 0);
    const q: number[] = [start];
    while (q.length) {
      const cur = q.shift()!;
      const cd = dist.get(cur)!;
      if (cd >= u.speed) continue;
      const cx = cur % BW, cy = Math.floor(cur / BW);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue;
          const nk = ny * BW + nx;
          if (this.unitAt(nx, ny)) continue; // blocked by a unit
          if (dist.has(nk)) continue;
          dist.set(nk, cd + 1);
          out.add(nk);
          q.push(nk);
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
    const mult = this.multiplier(attacker.atk, target.def);
    const hit = this.applyDamage(target, base * mult);
    if (isShot && attacker.shots > 0) attacker.shots--;
    let retaliation: AttackResult | undefined;
    if (!isShot && target.count > 0 && !target.retaliatedThisRound) {
      const rBase = this.rollBaseDamage(target);
      const rMult = this.multiplier(target.atk, attacker.def);
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

export function aiDecide(battle: Battle, u: BattleUnit): AiAction {
  const enemies = battle.units.filter((e) => e.count > 0 && e.side !== u.side);
  if (enemies.length === 0) return { kind: "wait" };

  // Prefer shooting the weakest enemy if able.
  if (battle.canShoot(u)) {
    const target = enemies.reduce((a, b) => (b.count * b.maxHp < a.count * a.maxHp ? b : a));
    return { kind: "shoot", target };
  }

  // Already adjacent? Attack the best target.
  const adj = enemies.filter((e) => Battle.adjacent(u.x, u.y, e.x, e.y));
  if (adj.length) {
    const target = adj.reduce((a, b) => (b.atk > a.atk ? b : a));
    return { kind: "attack", target, from: { x: u.x, y: u.y } };
  }

  // Otherwise advance toward the nearest enemy, attacking if we can reach.
  const reach = battle.reachable(u);
  reach.add(u.y * BW + u.x);
  let best: { cell: number; target: BattleUnit; d: number } | null = null;
  let bestMoveCell = -1;
  let bestMoveDist = Infinity;
  for (const cell of reach) {
    const cx = cell % BW, cy = Math.floor(cell / BW);
    for (const e of enemies) {
      const d = Math.max(Math.abs(cx - e.x), Math.abs(cy - e.y));
      if (d === 1 && (!best || d < best.d)) best = { cell, target: e, d };
      // track closest approach for pure movement
      const approach = Math.hypot(cx - e.x, cy - e.y);
      if (approach < bestMoveDist) { bestMoveDist = approach; bestMoveCell = cell; }
    }
  }
  if (best) {
    return { kind: "attack", target: best.target, from: { x: best.cell % BW, y: Math.floor(best.cell / BW) } };
  }
  if (bestMoveCell >= 0 && bestMoveCell !== u.y * BW + u.x) {
    return { kind: "move", to: { x: bestMoveCell % BW, y: Math.floor(bestMoveCell / BW) } };
  }
  return { kind: "wait" };
}
