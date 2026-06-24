// Tactical battle scene: drives the combat model with movement/attack animation,
// player control of the hero's stacks, and a threat-based enemy AI. It surfaces
// the tactics — an initiative order, Wait/Defend stances, battlefield obstacles
// and a damage forecast — so each turn is a real decision. On resolution it
// writes survivors back to the hero's army and reports the outcome.
import type { App } from "../app";
import { Scene } from "../engine/scene";
import { Renderer } from "../engine/renderer";
import { Input } from "../engine/input";
import { Sfx } from "../engine/audio";
import { Battle, BattleUnit, BW, BH, aiDecide } from "../game/combat";
import { CREATURES } from "../data/creatures";
import { Stack } from "../game/army";
import { creatureSprite } from "../art/sprites_creatures";
import { Button, button, glass, panel, parchment, pointInRect, roundRectPath, text, textShadow, wrapText } from "../ui/widgets";

export interface BattleOutcome {
  playerWon: boolean;
  enemyName: string;
}

interface BattleLayout {
  vw: number; vh: number;
  topH: number; iniH: number; ctrlH: number;
  cell: number; gx: number; gy: number;
  btnWait: Button; btnDefend: Button; btnAuto: Button; btnFlee: Button;
}

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
  private banner = ""; // transient narration ("Cavalry waits", "Pikemen defend")
  private bannerT = 0;
  private lay!: BattleLayout;

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
    this.lay = this.layout();
    this.beginTurn();
  }

  // Compute a responsive layout: top info bar, an initiative strip, a centered
  // grid sized to fit, and a touch-friendly four-button control bar.
  private layout(): BattleLayout {
    const r = this.app.renderer;
    const vw = r.vw, vh = r.vh;
    const topH = Math.round(Math.min(72, Math.max(54, vh * 0.1)));
    const iniH = Math.round(Math.min(46, Math.max(34, vh * 0.06)));
    const ctrlH = Math.round(Math.min(76, Math.max(60, vh * 0.1)));
    const pad = 8;
    const gridTop = topH + iniH;
    const gridH = vh - gridTop - ctrlH;
    const cell = Math.max(20, Math.floor(Math.min((vw - pad * 2) / BW, (gridH - pad * 2) / BH)));
    const gx = Math.round((vw - cell * BW) / 2);
    const gy = Math.round(gridTop + (gridH - cell * BH) / 2);
    const side = 10, gap = 8;
    const bw = (vw - side * 2 - gap * 3) / 4;
    const by = vh - ctrlH + (ctrlH - 46) / 2, bh = 46;
    const at = (i: number): number => side + (bw + gap) * i;
    const btnWait: Button = { x: at(0), y: by, w: bw, h: bh, label: "Wait" };
    const btnDefend: Button = { x: at(1), y: by, w: bw, h: bh, label: "Defend" };
    const btnAuto: Button = { x: at(2), y: by, w: bw, h: bh, label: "Auto", primary: true };
    const btnFlee: Button = { x: at(3), y: by, w: bw, h: bh, label: "Flee" };
    return { vw, vh, topH, iniH, ctrlH, cell, gx, gy, btnWait, btnDefend, btnAuto, btnFlee };
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

  private flashBanner(msg: string): void {
    this.banner = msg;
    this.bannerT = 1.1;
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
    this.lay = this.layout();
    // floaters + banner
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1);
    if (this.bannerT > 0) this.bannerT -= dt;
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

    for (const k of input.takeKeys()) this.handleKey(k);
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

  private handleKey(k: string): void {
    if (this.phase === "over") {
      if (k === "Enter" || k === " ") this.continueOut();
      return;
    }
    if (this.phase !== "player") return;
    const low = k.toLowerCase();
    if (low === "w") this.doWait();
    else if (low === "d" || k === "Enter" || k === " ") this.doDefend();
    else if (low === "a") this.autoBattle();
    else if (low === "f") this.flee();
  }

  private continueOut(): void {
    Sfx.click();
    this.onResult({ playerWon: this.battle.winner === "attacker", enemyName: this.enemyName });
  }

  private doDefend(): void {
    Sfx.click();
    const a = this.battle.active;
    if (a) this.flashBanner(`${CREATURES[a.cid].name} brace for impact`);
    this.battle.defendActive();
    this.beginTurn();
  }

  private doWait(): void {
    const a = this.battle.active;
    if (!a || !this.battle.canWait(a)) return;
    Sfx.click();
    this.flashBanner(`${CREATURES[a.cid].name} hold for now`);
    this.battle.waitActive();
    this.beginTurn();
  }

  private handleClick(px: number, py: number): void {
    if (this.phase === "over") { this.continueOut(); return; }
    if (this.phase !== "player") return;
    // buttons
    if (pointInRect(px, py, this.lay.btnWait)) { this.doWait(); return; }
    if (pointInRect(px, py, this.lay.btnDefend)) { this.doDefend(); return; }
    if (pointInRect(px, py, this.lay.btnAuto)) { Sfx.click(); this.autoBattle(); return; }
    if (pointInRect(px, py, this.lay.btnFlee)) { Sfx.click(); this.flee(); return; }

    const cell = this.pointToCell(px, py);
    if (cell.x < 0) return;
    const u = this.battle.active!;
    const target = this.battle.unitAt(cell.x, cell.y);
    if (target && target.side !== u.side) {
      this.tryAttack(u, target);
    } else if (!target && !this.battle.isObstacle(cell.x, cell.y) && this.reach.has(cell.y * BW + cell.x)) {
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
        if (this.battle.isObstacle(nx, ny)) continue;
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
    const { gx, gy, cell } = this.lay;
    return { x: gx + x * cell + cell / 2, y: gy + y * cell + cell / 2 };
  }
  private pointToCell(px: number, py: number): { x: number; y: number } {
    const { gx, gy, cell } = this.lay;
    const x = Math.floor((px - gx) / cell);
    const y = Math.floor((py - gy) / cell);
    if (x < 0 || y < 0 || x >= BW || y >= BH) return { x: -1, y: -1 };
    return { x, y };
  }

  // ---------- drawing ----------
  draw(r: Renderer): void {
    const ctx = r.ctx;
    this.lay = this.layout();
    // sky + field
    const g = ctx.createLinearGradient(0, 0, 0, r.vh);
    g.addColorStop(0, "#9fc88a");
    g.addColorStop(0.5, "#6fa84e");
    g.addColorStop(1, "#4f8a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r.vw, r.vh);

    this.drawGrid(ctx);
    if (this.phase === "player") this.drawReach(ctx);
    this.drawObstacles(ctx);
    this.drawTargeting(ctx);
    this.drawHoverAndActive(ctx);
    this.drawUnits(ctx);
    this.drawFloaters(ctx);
    this.drawTopBar(ctx);
    this.drawInitiative(ctx);
    if (this.phase === "player") this.drawPreview(ctx);
    this.drawBanner(ctx);
    this.drawControls(ctx);
    if (this.phase === "over") this.drawResult(ctx);
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const { gx, gy, cell } = this.lay;
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const sx = gx + x * cell, sy = gy + y * cell;
        ctx.fillStyle = (x + y) % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
        ctx.fillRect(sx, sy, cell, cell);
        ctx.strokeStyle = "rgba(40,30,12,0.18)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, cell, cell);
      }
    }
  }

  private drawReach(ctx: CanvasRenderingContext2D): void {
    const { gx, gy, cell } = this.lay;
    ctx.fillStyle = "rgba(120,200,255,0.18)";
    for (const k of this.reach) {
      const x = k % BW, y = Math.floor(k / BW);
      ctx.fillRect(gx + x * cell + 2, gy + y * cell + 2, cell - 4, cell - 4);
    }
  }

  // Rocky boulders that block movement.
  private drawObstacles(ctx: CanvasRenderingContext2D): void {
    const { gx, gy, cell } = this.lay;
    for (const k of this.battle.obstacles) {
      const x = k % BW, y = Math.floor(k / BW);
      const cx = gx + x * cell + cell / 2;
      const cy = gy + y * cell + cell * 0.58;
      const rw = cell * 0.36, rh = cell * 0.28;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(cx, gy + y * cell + cell - 5, rw, rh * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // boulder body
      ctx.fillStyle = "#7c7468";
      ctx.beginPath();
      ctx.moveTo(cx - rw, cy + rh);
      ctx.lineTo(cx - rw * 0.7, cy - rh);
      ctx.lineTo(cx + rw * 0.2, cy - rh * 1.2);
      ctx.lineTo(cx + rw, cy - rh * 0.2);
      ctx.lineTo(cx + rw * 0.8, cy + rh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#9a9286";
      ctx.beginPath();
      ctx.moveTo(cx - rw * 0.7, cy - rh);
      ctx.lineTo(cx + rw * 0.2, cy - rh * 1.2);
      ctx.lineTo(cx + rw * 0.1, cy);
      ctx.lineTo(cx - rw * 0.3, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(40,32,20,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // When hovering an attackable enemy, mark the cell we'd strike from.
  private drawTargeting(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== "player" || this.hover.x < 0) return;
    const u = this.battle.active;
    if (!u) return;
    const target = this.battle.unitAt(this.hover.x, this.hover.y);
    if (!target || target.side === u.side) return;
    if (this.battle.canShoot(u) || Battle.adjacent(u.x, u.y, target.x, target.y)) return;
    const from = this.bestAdjacentCell(u, target);
    if (!from) return;
    const c = this.cellCenter(from.x, from.y);
    const { cell } = this.lay;
    ctx.strokeStyle = "#ffe07a";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(c.x - cell / 2 + 3, c.y - cell / 2 + 3, cell - 6, cell - 6);
    ctx.setLineDash([]);
  }

  private drawHoverAndActive(ctx: CanvasRenderingContext2D): void {
    const { cell } = this.lay;
    const a = this.battle.active;
    if (a) {
      const c = this.cellCenter(a.x, a.y);
      ctx.strokeStyle = "#fff0a0";
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x - cell / 2 + 2, c.y - cell / 2 + 2, cell - 4, cell - 4);
    }
    if (this.hover.x >= 0 && this.phase === "player") {
      const t = this.battle.unitAt(this.hover.x, this.hover.y);
      const c = this.cellCenter(this.hover.x, this.hover.y);
      ctx.strokeStyle = t && a && t.side !== a.side ? "#ff6a4a" : "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - cell / 2 + 1, c.y - cell / 2 + 1, cell - 2, cell - 2);
    }
  }

  private drawUnits(ctx: CanvasRenderingContext2D): void {
    const { gx, gy, cell } = this.lay;
    const order = [...this.battle.units].filter((u) => u.count > 0).sort((a, b) => a.y - b.y);
    for (const u of order) {
      const rp = this.rpos.get(u)!;
      const cx = gx + rp.x * cell + cell / 2;
      const bottom = gy + rp.y * cell + cell - 6;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(cx, bottom - 2, cell * 0.28, cell * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      const spr = creatureSprite(u.cid);
      const scale = Math.max(1, Math.floor(Math.min((cell - 8) / spr.w, (cell - 8) / spr.h)));
      if (u.side === "attacker") spr.drawCenteredBottom(ctx, cx, bottom, scale);
      else {
        ctx.save();
        ctx.translate(cx + (spr.w * scale) / 2, bottom - spr.h * scale);
        ctx.scale(-1, 1);
        spr.draw(ctx, 0, 0, scale);
        ctx.restore();
      }
      // defending shield
      if (u.defending) this.drawShield(ctx, cx + cell * 0.30, gy + rp.y * cell + cell * 0.30, cell * 0.18);
      // count badge
      const badge = u.side === "attacker" ? "#28548f" : "#8f2b27";
      panel(ctx, cx - 16, bottom + 1, 32, 14, badge, "#cccccc", "#1c1208");
      text(ctx, String(u.count), cx, bottom + 12, "#fff0c8", "bold 12px 'Trebuchet MS'", "center");
    }
  }

  private drawShield(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.fillStyle = "#d8c089";
    ctx.strokeStyle = "#5b3a10";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.quadraticCurveTo(cx + r, cy + r * 1.3, cx, cy + r * 1.5);
    ctx.quadraticCurveTo(cx - r, cy + r * 1.3, cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#8f2b27";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.6);
    ctx.lineTo(cx, cy + r * 0.9);
    ctx.moveTo(cx - r * 0.6, cy);
    ctx.lineTo(cx + r * 0.6, cy);
    ctx.stroke();
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floaters) {
      ctx.globalAlpha = 1 - f.t;
      textShadow(ctx, f.text, f.x, f.y - f.t * 26, f.color, "bold 16px 'Trebuchet MS'", "center");
      ctx.globalAlpha = 1;
    }
  }

  private drawTopBar(ctx: CanvasRenderingContext2D): void {
    const { vw, topH } = this.lay;
    glass(ctx, 0, 0, vw, topH, 0, 0.66);
    const a = this.battle.active;
    textShadow(ctx, `Round ${this.battle.round}`, 14, 24, "#fff0c8", "bold 17px 'Trebuchet MS'");
    textShadow(ctx, `vs ${this.enemyName}`, 14, topH - 12, "#e8c0a0", "13px 'Trebuchet MS'");
    if (a) {
      const c = CREATURES[a.cid];
      const who = a.side === "attacker" ? "Your move" : "Enemy";
      const col = a.side === "attacker" ? "#bfe89a" : "#e8a0a0";
      textShadow(ctx, `${who}: ${c.name}`, vw - 14, 24, col, "bold 16px 'Trebuchet MS'", "right");
      const def = this.battle.effDef(a);
      const defStr = a.defending ? `Def ${def}▲` : `Def ${def}`;
      textShadow(
        ctx,
        `×${a.count}  Atk ${a.atk}  ${defStr}  Spd ${a.speed}${a.ranged ? "  Shots " + a.shots : ""}`,
        vw - 14, topH - 12, "#e8d6a4", "13px 'Trebuchet MS'", "right");
    }
  }

  // Initiative strip: the next stacks to act, in order, active highlighted.
  private drawInitiative(ctx: CanvasRenderingContext2D): void {
    const { vw, topH, iniH } = this.lay;
    glass(ctx, 0, topH, vw, iniH, 0, 0.5);
    textShadow(ctx, "Turn order", 10, topH + iniH / 2 + 4, "#cdb98a", "11px 'Trebuchet MS'");
    const labelW = 78;
    const tile = iniH - 10;
    const order = this.battle.upcoming(Math.max(1, Math.floor((vw - labelW - 10) / (tile + 4))));
    let x = labelW;
    const y = topH + 5;
    for (let i = 0; i < order.length; i++) {
      const u = order[i];
      const isActive = i === 0;
      roundRectPath(ctx, x, y, tile, tile, 4);
      ctx.fillStyle = u.side === "attacker" ? "#27406a" : "#6a2622";
      ctx.fill();
      if (isActive) {
        ctx.strokeStyle = "#ffe07a";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (u.waited) {
        ctx.strokeStyle = "rgba(220,200,140,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const spr = creatureSprite(u.cid);
      const s = Math.max(1, Math.floor(Math.min((tile - 6) / spr.w, (tile - 8) / spr.h)));
      spr.drawCenteredBottom(ctx, x + tile / 2, y + tile - 3, s);
      text(ctx, String(u.count), x + tile / 2, y + tile - 1, "#ffe6b8", "bold 9px 'Trebuchet MS'", "center");
      x += tile + 4;
    }
  }

  // Damage forecast when the active stack hovers an attackable enemy.
  private drawPreview(ctx: CanvasRenderingContext2D): void {
    const u = this.battle.active;
    if (!u || this.hover.x < 0) return;
    const target = this.battle.unitAt(this.hover.x, this.hover.y);
    if (!target || target.side === u.side) return;
    const canShoot = this.battle.canShoot(u);
    const meleeReady = Battle.adjacent(u.x, u.y, target.x, target.y);
    const canReach = canShoot || meleeReady || !!this.bestAdjacentCell(u, target);
    if (!canReach) return;

    const est = this.battle.estimate(u, target);
    const kind = canShoot ? "Shoot" : "Strike";
    const dmg = est.dmgMin === est.dmgMax ? `${est.dmgMin}` : `${est.dmgMin}–${est.dmgMax}`;
    const killHi = Math.max(est.killMin, est.killMax);
    const l1 = `${kind} ${CREATURES[target.cid].name}`;
    const l2 = `~${dmg} dmg` + (killHi > 0 ? `, up to ${killHi} slain` : "");
    const willRetaliate = !canShoot && target.count > 0 && !target.retaliatedThisRound;
    const l3 = canShoot ? "no retaliation" : willRetaliate ? "they will retaliate" : "no retaliation left";

    const { gx, gy, cell, topH, iniH } = this.lay;
    const w = 184, h = 64;
    let px = gx + this.hover.x * cell + cell + 8;
    let py = gy + this.hover.y * cell - 8;
    if (px + w > this.lay.vw - 6) px = gx + this.hover.x * cell - w - 8;
    px = Math.max(6, px);
    py = Math.min(Math.max(topH + iniH + 6, py), this.lay.vh - this.lay.ctrlH - h - 6);
    parchment(ctx, px, py, w, h);
    text(ctx, l1, px + 12, py + 22, "#3a2410", "bold 14px 'Trebuchet MS'");
    text(ctx, l2, px + 12, py + 40, "#7a2a14", "13px 'Trebuchet MS'");
    text(ctx, l3, px + 12, py + 56, willRetaliate ? "#9c5a1a" : "#4a6a2a", "12px 'Trebuchet MS'");
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    if (this.bannerT <= 0 || !this.banner) return;
    const { vw, topH, iniH } = this.lay;
    ctx.globalAlpha = Math.min(1, this.bannerT);
    textShadow(ctx, this.banner, vw / 2, topH + iniH + 26, "#fff0c8", "bold 16px 'Trebuchet MS'", "center");
    ctx.globalAlpha = 1;
  }

  private drawControls(ctx: CanvasRenderingContext2D): void {
    const { vw, vh, ctrlH } = this.lay;
    glass(ctx, 0, vh - ctrlH, vw, ctrlH, 0, 0.66);
    const enabled = this.phase === "player";
    const a = this.battle.active;
    button(ctx, { ...this.lay.btnWait, enabled: enabled && this.battle.canWait(a) }, false);
    button(ctx, { ...this.lay.btnDefend, enabled }, false);
    button(ctx, { ...this.lay.btnAuto, enabled }, false);
    button(ctx, { ...this.lay.btnFlee, enabled }, false);
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const { vw, vh } = this.lay;
    const won = this.battle.winner === "attacker";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, vw, vh);
    const w = Math.min(420, vw - 32), h = 190, x = (vw - w) / 2, y = (vh - h) / 2;
    parchment(ctx, x, y, w, h);
    textShadow(ctx, won ? "Victory!" : "Defeat", x + w / 2, y + 52, won ? "#3a7a1a" : "#9c2a1a", "bold 32px 'Trebuchet MS'", "center");
    wrapText(ctx, this.resultText, x + 24, y + 86, w - 48, 22, "#3a2410", "15px 'Trebuchet MS'");
    const b: Button = { x: x + w / 2 - 90, y: y + h - 60, w: 180, h: 48, label: "Continue", primary: true };
    button(ctx, b, false);
  }
}
