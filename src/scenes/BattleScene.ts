// Tactical battle scene: drives the combat model with movement/attack animation,
// player control of the hero's stacks, and a simple enemy AI. On resolution it
// writes survivors back to the hero's army and reports the outcome.
import type { App } from "../app";
import { Scene } from "../engine/scene";
import { Renderer, VW, VH } from "../engine/renderer";
import { Input } from "../engine/input";
import { Sfx } from "../engine/audio";
import { Battle, BattleUnit, BW, BH, aiDecide } from "../game/combat";
import { CREATURES } from "../data/creatures";
import { Stack } from "../game/army";
import { creatureSprite } from "../art/sprites_creatures";
import { Button, button, panel, parchment, pointInRect, text, textShadow } from "../ui/widgets";

export interface BattleOutcome {
  playerWon: boolean;
  enemyName: string;
}

const CELL = 58;
const GX = Math.round((VW - BW * CELL) / 2);
const GY = 78;

interface Floater { x: number; y: number; text: string; color: string; t: number; }
type Step =
  | { kind: "move"; unit: BattleUnit; to: { x: number; y: number } }
  | { kind: "strike"; unit: BattleUnit; target: BattleUnit; isShot: boolean };

export class BattleScene implements Scene {
  private battle: Battle;
  private phase: "player" | "enemy" | "anim" | "over" = "player";
  private reach = new Set<number>();
  private hover = { x: -1, y: -1 };
  private rpos = new Map<BattleUnit, { x: number; y: number }>();
  private floaters: Floater[] = [];
  private steps: Step[] = [];
  private curStep: Step | null = null;
  private stepT = 0;
  private stepDur = 0.25;
  private thinkTimer = 0;
  private resultText = "";

  private btnWait: Button = { x: GX, y: GY + BH * CELL + 14, w: 120, h: 36, label: "Defend" };
  private btnAuto: Button = { x: GX + 132, y: GY + BH * CELL + 14, w: 120, h: 36, label: "Auto Battle" };
  private btnFlee: Button = { x: GX + 264, y: GY + BH * CELL + 14, w: 120, h: 36, label: "Flee" };

  constructor(
    private app: App,
    enemyStacks: Stack[],
    enemyAtk: number,
    enemyDef: number,
    private enemyName: string,
    private onResult: (o: BattleOutcome) => void,
  ) {
    const h = app.state.hero;
    this.battle = new Battle(h.army, h.attack, h.defense, enemyStacks, enemyAtk, enemyDef);
    for (const u of this.battle.units) this.rpos.set(u, { x: u.x, y: u.y });
    this.beginTurn();
  }

  // ---------- turn flow ----------
  private beginTurn(): void {
    if (!this.battle.active || this.battle.winner) { this.finish(); return; }
    const u = this.battle.active;
    if (u.side === "attacker") {
      this.phase = "player";
      this.reach = this.battle.reachable(u);
    } else {
      this.phase = "enemy";
      this.thinkTimer = 0.45;
    }
  }

  private endTurnAndAdvance(): void {
    this.battle.endActiveTurn();
    this.beginTurn();
  }

  private queue(steps: Step[]): void {
    this.steps = steps;
    this.startNextStep();
  }

  private startNextStep(): void {
    const s = this.steps.shift() ?? null;
    this.curStep = s;
    if (!s) { this.endTurnAndAdvance(); return; }
    this.phase = "anim";
    this.stepT = 0;
    if (s.kind === "move") {
      this.stepDur = 0.06 + 0.04 * Math.max(Math.abs(s.unit.x - s.to.x), Math.abs(s.unit.y - s.to.y));
      this.battle.moveTo(s.unit, s.to.x, s.to.y);
    } else {
      this.stepDur = 0.4;
      const res = this.battle.attack(s.unit, s.target, s.isShot);
      if (s.isShot) Sfx.shoot(); else Sfx.hit();
      this.pushFloater(s.target, `-${res.hit.damage}`, "#ff6a4a");
      if (res.hit.killed > 0) this.pushFloater(s.target, `${res.hit.killed} slain`, "#ffd0a0", 18);
      if (res.retaliation) {
        Sfx.hit();
        this.pushFloater(s.unit, `-${res.retaliation.damage}`, "#ffd24a");
      }
    }
  }

  private pushFloater(u: BattleUnit, str: string, color: string, dy = 0): void {
    const c = this.cellCenter(u.x, u.y);
    this.floaters.push({ x: c.x, y: c.y - 24 - dy, text: str, color, t: 0 });
  }

  private finish(): void {
    const won = this.battle.winner === "attacker";
    // write survivors back to the hero's army by slot
    const army = this.app.state.hero.army;
    for (let i = 0; i < army.length; i++) {
      const u = this.battle.units.find((x) => x.side === "attacker" && x.slot === i);
      army[i] = u && u.count > 0 ? { id: u.cid, count: u.count } : null;
    }
    this.resultText = won
      ? `Your forces are victorious over ${this.enemyName}!`
      : `Your army was crushed by ${this.enemyName}.`;
    this.phase = "over";
  }

  // ---------- input / actions ----------
  update(dt: number, input: Input): void {
    // floaters
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1);
    // ease render positions toward model
    for (const u of this.battle.units) {
      const rp = this.rpos.get(u)!;
      if (this.phase === "anim" && this.curStep && (this.curStep as any).unit === u) {
        // handled by anim
      } else {
        rp.x += (u.x - rp.x) * Math.min(1, dt * 12);
        rp.y += (u.y - rp.y) * Math.min(1, dt * 12);
      }
    }

    const p = input.pointer;
    this.hover = this.pointToCell(p.x, p.y);

    if (this.phase === "anim") this.updateAnim(dt);
    else if (this.phase === "enemy") {
      this.thinkTimer -= dt;
      if (this.thinkTimer <= 0) this.runEnemy();
    }

    for (const c of input.takeClicks()) this.handleClick(c.x, c.y);
  }

  private updateAnim(dt: number): void {
    const s = this.curStep!;
    this.stepT += dt / this.stepDur;
    const rp = this.rpos.get(s.unit)!;
    if (s.kind === "move") {
      // rp already holds old pos; lerp to model pos
      const from = (s as any)._from ?? (((s as any)._from = { x: rp.x, y: rp.y }));
      rp.x = from.x + (s.unit.x - from.x) * Math.min(1, this.stepT);
      rp.y = from.y + (s.unit.y - from.y) * Math.min(1, this.stepT);
    } else {
      // lunge toward target and back
      const dir = s.target.x >= s.unit.x ? 1 : -1;
      const lunge = Math.sin(Math.min(1, this.stepT) * Math.PI) * 0.35 * (s.isShot ? 0 : 1);
      rp.x = s.unit.x + dir * lunge;
      rp.y = s.unit.y;
    }
    if (this.stepT >= 1) {
      rp.x = s.unit.x; rp.y = s.unit.y;
      this.startNextStep();
    }
  }

  private handleClick(px: number, py: number): void {
    if (this.phase === "over") { Sfx.click(); this.onResult({ playerWon: this.battle.winner === "attacker", enemyName: this.enemyName }); return; }
    if (this.phase !== "player") return;
    // buttons
    if (pointInRect(px, py, this.btnWait)) { Sfx.click(); this.endTurnAndAdvance(); return; }
    if (pointInRect(px, py, this.btnAuto)) { Sfx.click(); this.autoBattle(); return; }
    if (pointInRect(px, py, this.btnFlee)) { Sfx.click(); this.flee(); return; }

    const cell = this.pointToCell(px, py);
    if (cell.x < 0) return;
    const u = this.battle.active!;
    const target = this.battle.unitAt(cell.x, cell.y);
    if (target && target.side !== u.side) {
      this.tryAttack(u, target);
    } else if (!target && this.reach.has(cell.y * BW + cell.x)) {
      Sfx.click();
      this.queue([{ kind: "move", unit: u, to: cell }]);
    }
  }

  private tryAttack(u: BattleUnit, target: BattleUnit): void {
    if (this.battle.canShoot(u)) {
      Sfx.click();
      this.queue([{ kind: "strike", unit: u, target, isShot: true }]);
      return;
    }
    // melee: need to be adjacent; find best reachable adjacent cell
    if (Battle.adjacent(u.x, u.y, target.x, target.y)) {
      Sfx.click();
      this.queue([{ kind: "strike", unit: u, target, isShot: false }]);
      return;
    }
    const cell = this.bestAdjacentCell(u, target);
    if (cell) {
      Sfx.click();
      this.queue([
        { kind: "move", unit: u, to: cell },
        { kind: "strike", unit: u, target, isShot: false },
      ]);
    }
  }

  private bestAdjacentCell(u: BattleUnit, target: BattleUnit): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = target.x + dx, ny = target.y + dy;
        if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue;
        const k = ny * BW + nx;
        const here = nx === u.x && ny === u.y;
        if (!here && !this.reach.has(k)) continue;
        if (this.battle.unitAt(nx, ny) && !here) continue;
        const d = Math.hypot(nx - u.x, ny - u.y);
        if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
      }
    }
    return best;
  }

  private runEnemy(): void {
    const u = this.battle.active!;
    const action = aiDecide(this.battle, u);
    switch (action.kind) {
      case "shoot":
        this.queue([{ kind: "strike", unit: u, target: action.target, isShot: true }]);
        break;
      case "attack": {
        const steps: Step[] = [];
        if (action.from.x !== u.x || action.from.y !== u.y) steps.push({ kind: "move", unit: u, to: action.from });
        steps.push({ kind: "strike", unit: u, target: action.target, isShot: false });
        this.queue(steps);
        break;
      }
      case "move":
        this.queue([{ kind: "move", unit: u, to: action.to }]);
        break;
      default:
        this.endTurnAndAdvance();
    }
  }

  private autoBattle(): void {
    // resolve remaining battle instantly using AI for both sides
    let guard = 0;
    while (!this.battle.winner && guard++ < 4000) {
      const u = this.battle.active;
      if (!u) break;
      const action = aiDecide(this.battle, u);
      if (action.kind === "shoot") this.battle.attack(u, action.target, true);
      else if (action.kind === "attack") {
        if (action.from.x !== u.x || action.from.y !== u.y) this.battle.moveTo(u, action.from.x, action.from.y);
        this.battle.attack(u, action.target, false);
      } else if (action.kind === "move") this.battle.moveTo(u, action.to.x, action.to.y);
      this.battle.endActiveTurn();
    }
    for (const u of this.battle.units) { const rp = this.rpos.get(u)!; rp.x = u.x; rp.y = u.y; }
    this.finish();
  }

  private flee(): void {
    // retreat: the hero survives but loses this battle's army engagement
    this.battle.winner = "defender";
    this.finish();
  }

  // ---------- geometry ----------
  private cellCenter(x: number, y: number): { x: number; y: number } {
    return { x: GX + x * CELL + CELL / 2, y: GY + y * CELL + CELL / 2 };
  }
  private pointToCell(px: number, py: number): { x: number; y: number } {
    const x = Math.floor((px - GX) / CELL);
    const y = Math.floor((py - GY) / CELL);
    if (x < 0 || y < 0 || x >= BW || y >= BH) return { x: -1, y: -1 };
    return { x, y };
  }

  // ---------- drawing ----------
  draw(r: Renderer): void {
    const ctx = r.ctx;
    // sky + field
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#9fc88a");
    g.addColorStop(0.5, "#6fa84e");
    g.addColorStop(1, "#4f8a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    this.drawGrid(ctx);
    if (this.phase === "player") this.drawReach(ctx);
    this.drawHoverAndActive(ctx);
    this.drawUnits(ctx);
    this.drawFloaters(ctx);
    this.drawTopBar(ctx);
    this.drawControls(ctx);
    if (this.phase === "over") this.drawResult(ctx);
  }


  private drawGrid(ctx: CanvasRenderingContext2D): void {
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const sx = GX + x * CELL, sy = GY + y * CELL;
        ctx.fillStyle = (x + y) % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
        ctx.fillRect(sx, sy, CELL, CELL);
        ctx.strokeStyle = "rgba(40,30,12,0.18)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, CELL, CELL);
      }
    }
  }

  private drawReach(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(120,200,255,0.18)";
    for (const k of this.reach) {
      const x = k % BW, y = Math.floor(k / BW);
      ctx.fillRect(GX + x * CELL + 2, GY + y * CELL + 2, CELL - 4, CELL - 4);
    }
  }

  private drawHoverAndActive(ctx: CanvasRenderingContext2D): void {
    const a = this.battle.active;
    if (a) {
      const c = this.cellCenter(a.x, a.y);
      ctx.strokeStyle = "#fff0a0";
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x - CELL / 2 + 2, c.y - CELL / 2 + 2, CELL - 4, CELL - 4);
    }
    if (this.hover.x >= 0 && this.phase === "player") {
      const t = this.battle.unitAt(this.hover.x, this.hover.y);
      const c = this.cellCenter(this.hover.x, this.hover.y);
      ctx.strokeStyle = t && a && t.side !== a.side ? "#ff6a4a" : "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - CELL / 2 + 1, c.y - CELL / 2 + 1, CELL - 2, CELL - 2);
    }
  }

  private drawUnits(ctx: CanvasRenderingContext2D): void {
    const order = [...this.battle.units].filter((u) => u.count > 0).sort((a, b) => a.y - b.y);
    for (const u of order) {
      const rp = this.rpos.get(u)!;
      const cx = GX + rp.x * CELL + CELL / 2;
      const bottom = GY + rp.y * CELL + CELL - 6;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(cx, bottom - 2, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      const spr = creatureSprite(u.cid);
      const scale = Math.max(2, Math.floor(Math.min((CELL - 8) / spr.w, (CELL - 8) / spr.h)));
      if (u.side === "attacker") spr.drawCenteredBottom(ctx, cx, bottom, scale);
      else {
        ctx.save();
        ctx.translate(cx + (spr.w * scale) / 2, bottom - spr.h * scale);
        ctx.scale(-1, 1);
        spr.draw(ctx, 0, 0, scale);
        ctx.restore();
      }
      // count badge
      const badge = u.side === "attacker" ? "#28548f" : "#8f2b27";
      panel(ctx, cx - 16, bottom + 1, 32, 14, badge, "#cccccc", "#1c1208");
      text(ctx, String(u.count), cx, bottom + 12, "#fff0c8", "bold 12px 'Trebuchet MS'", "center");
    }
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floaters) {
      ctx.globalAlpha = 1 - f.t;
      textShadow(ctx, f.text, f.x, f.y - f.t * 26, f.color, "bold 16px 'Trebuchet MS'", "center");
      ctx.globalAlpha = 1;
    }
  }

  private drawTopBar(ctx: CanvasRenderingContext2D): void {
    panel(ctx, 0, 0, VW, GY - 12);
    const a = this.battle.active;
    textShadow(ctx, `Battle — Round ${this.battle.round}`, 20, 30, "#fff0c8", "bold 18px 'Trebuchet MS'");
    textShadow(ctx, `vs ${this.enemyName}`, 20, 52, "#e8c0a0", "14px 'Trebuchet MS'");
    if (a) {
      const c = CREATURES[a.cid];
      const who = a.side === "attacker" ? "Your turn:" : "Enemy:";
      textShadow(ctx, `${who} ${c.name} (${a.count})  Spd ${a.speed}${a.ranged ? "  Shots " + a.shots : ""}`,
        VW - 20, 38, a.side === "attacker" ? "#bfe89a" : "#e8a0a0", "bold 16px 'Trebuchet MS'", "right");
    }
  }

  private drawControls(ctx: CanvasRenderingContext2D): void {
    const enabled = this.phase === "player";
    button(ctx, { ...this.btnWait, enabled }, false);
    button(ctx, { ...this.btnAuto, enabled }, false);
    button(ctx, { ...this.btnFlee, enabled }, false);
    text(ctx, "Click a glowing tile to move, an enemy to attack. Ranged units shoot at range.",
      GX + 400, GY + BH * CELL + 36, "#1c1208", "13px 'Trebuchet MS'");
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const won = this.battle.winner === "attacker";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, VW, VH);
    const w = 460, h = 180, x = (VW - w) / 2, y = (VH - h) / 2;
    parchment(ctx, x, y, w, h);
    textShadow(ctx, won ? "Victory!" : "Defeat", x + w / 2, y + 56, won ? "#3a7a1a" : "#9c2a1a", "bold 32px 'Trebuchet MS'", "center");
    text(ctx, this.resultText, x + w / 2, y + 96, "#3a2410", "15px 'Trebuchet MS'", "center");
    const b: Button = { x: x + w / 2 - 80, y: y + h - 54, w: 160, h: 40, label: "Continue" };
    button(ctx, b, false);
  }
}
