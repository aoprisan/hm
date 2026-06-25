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
import { Battle, BattleUnit, BW, BH, aiDecide, aiCastDecision } from "../game/combat";
import { CREATURES } from "../data/creatures";
import { SPELLS, SpellId, Spell } from "../data/spells";
import { Stack, Army, addToArmy } from "../game/army";
import { creatureSprite } from "../art/sprites_creatures";
import { Button, button, glass, panel, parchment, pointInRect, roundRectPath, text, textShadow, wrapText } from "../ui/widgets";

export interface BattleOutcome {
  playerWon: boolean;
  enemyName: string;
}

// Fraction of the enemy's slain that a Necropolis hero raises as Skeletons.
const NECRO_RATE = 0.2;

interface BattleLayout {
  vw: number; vh: number;
  topH: number; iniH: number; ctrlH: number;
  cell: number; gx: number; gy: number;
  btnWait: Button; btnDefend: Button; btnAuto: Button; btnFlee: Button;
  btnCast?: Button; // only when the hero knows spells
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
  private pickingSpell = false; // spell list open, awaiting a spell choice
  private casting: SpellId | null = null; // spell chosen, awaiting a target
  private time = 0; // wall-clock accumulator for ambient animation (flames)
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
    // A Cast button joins the row only when the hero has learned spells.
    const hasSpells = this.app.state.hero.spells.length > 0;
    const n = hasSpells ? 5 : 4;
    const bw = (vw - side * 2 - gap * (n - 1)) / n;
    const by = vh - ctrlH + (ctrlH - 46) / 2, bh = 46;
    const at = (i: number): number => side + (bw + gap) * i;
    let i = 0;
    const btnWait: Button = { x: at(i++), y: by, w: bw, h: bh, label: "Wait" };
    const btnDefend: Button = { x: at(i++), y: by, w: bw, h: bh, label: "Defend" };
    const btnCast: Button | undefined = hasSpells
      ? { x: at(i++), y: by, w: bw, h: bh, label: "Cast" } : undefined;
    const btnAuto: Button = { x: at(i++), y: by, w: bw, h: bh, label: "Auto", primary: true };
    const btnFlee: Button = { x: at(i++), y: by, w: bw, h: bh, label: "Flee" };
    return { vw, vh, topH, iniH, ctrlH, cell, gx, gy, btnWait, btnDefend, btnAuto, btnFlee, btnCast };
  }

  // ---------- turn flow ----------
  private beginTurn(): void {
    this.pickingSpell = false;
    this.casting = null;
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
      this.applyHazardAt(s.unit);
    } else {
      // a hazard may have wiped the attacker (or its target) before it strikes
      if (s.unit.count <= 0 || s.target.count <= 0) { this.startNextStep(); return; }
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

  // Wound a stack that just stepped onto quicksand / witchfire.
  private applyHazardAt(u: BattleUnit): void {
    const res = this.battle.applyHazard(u);
    if (!res) return;
    const fire = this.battle.featureAt(u.x, u.y) === "fire";
    Sfx.hit();
    this.pushFloater(u, `-${res.damage}`, fire ? "#ff9a3a" : "#c8b078");
    if (res.killed > 0) this.pushFloater(u, fire ? `${res.killed} burned` : `${res.killed} sank`, "#ffd0a0", 18);
    this.flashBanner(fire ? `${CREATURES[u.cid].name} scorched by witchfire` : `${CREATURES[u.cid].name} mired in quicksand`);
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
    if (won) this.resultText += this.necromancy(army);
    this.phase = "over";
  }

  // Necropolis heroes raise a share of the enemy's slain as Skeletons. Returns
  // a sentence to append to the result, or "" when nothing is raised.
  private necromancy(army: Army): string {
    if (this.app.state.town.faction !== "necropolis") return "";
    let slain = 0;
    for (const u of this.battle.units) {
      if (u.side === "defender") slain += Math.max(0, u.startCount - u.count);
    }
    const raised = Math.floor(slain * NECRO_RATE);
    if (raised <= 0) return "";
    if (!addToArmy(army, "skeleton", raised)) return ""; // army full — no room
    this.app.state.pushLog(`Necromancy raises ${raised} Skeletons from the fallen.`);
    return `\nNecromancy raises ${raised} Skeletons!`;
  }

  // ---------- input / actions ----------
  update(dt: number, input: Input): void {
    this.lay = this.layout();
    this.time += dt;
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
    if (k === "Escape") { this.pickingSpell = false; this.casting = null; return; }
    const low = k.toLowerCase();
    if (low === "c") this.openSpellMenu();
    else if (low === "w") this.doWait();
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

  // ---------- spellcasting ----------
  private openSpellMenu(): void {
    const hero = this.app.state.hero;
    if (!hero.spells.length) return;
    if (this.battle.castThisRound) { this.flashBanner("Already cast a spell this round"); return; }
    if (!hero.spells.some((s) => hero.mana >= SPELLS[s].cost)) { this.flashBanner("Not enough mana"); return; }
    Sfx.click();
    this.casting = null;
    this.pickingSpell = true;
  }

  // Rects for the pop-up spell list, stacked above the control bar.
  private spellMenuRects(): { sid: SpellId; rect: { x: number; y: number; w: number; h: number } }[] {
    const spells = this.app.state.hero.spells;
    const { vw, vh, ctrlH } = this.lay;
    const rowH = 44, gap = 6;
    const w = Math.min(280, vw - 20);
    const x = (vw - w) / 2;
    const top = vh - ctrlH - spells.length * (rowH + gap) - 8;
    return spells.map((sid, i) => ({ sid, rect: { x, y: top + i * (rowH + gap), w, h: rowH } }));
  }

  private handleSpellMenuClick(px: number, py: number): void {
    const hero = this.app.state.hero;
    for (const { sid, rect } of this.spellMenuRects()) {
      if (!pointInRect(px, py, rect)) continue;
      const sp = SPELLS[sid];
      if (hero.mana < sp.cost) { this.flashBanner("Not enough mana"); return; }
      Sfx.click();
      this.pickingSpell = false;
      this.casting = sid;
      this.flashBanner(sp.target === "enemy" ? "Choose an enemy stack" : "Choose an allied stack");
      return;
    }
    this.pickingSpell = false; // tapped outside the list — cancel
  }

  private handleCastTargetClick(px: number, py: number): void {
    const cell = this.pointToCell(px, py);
    const sp = SPELLS[this.casting!];
    const wantSide = sp.target === "enemy" ? "defender" : "attacker";
    if (cell.x < 0) { this.casting = null; return; }
    const target = this.battle.unitAt(cell.x, cell.y);
    if (!target || target.side !== wantSide || target.count <= 0) { this.casting = null; return; }
    this.castAt(sp, target);
  }

  private castAt(sp: Spell, target: BattleUnit): void {
    const hero = this.app.state.hero;
    const eff = this.battle.castSpell(sp, target);
    hero.mana -= sp.cost;
    this.battle.castThisRound = true;
    this.casting = null;
    Sfx.cast();
    this.flashBanner(`${hero.name} casts ${sp.name}`);
    if (eff.damage) {
      this.pushFloater(target, `-${eff.damage}`, "#c08aff");
      if (eff.killed) this.pushFloater(target, `${eff.killed} slain`, "#ffd0a0", 18);
    } else if (eff.revived) {
      this.pushFloater(target, `+${eff.revived} revived`, "#9affb0");
    } else if (eff.healed) {
      this.pushFloater(target, "healed", "#9affb0");
    } else {
      this.pushFloater(target, sp.name, "#9ad0ff");
    }
    // A nuke may have ended the battle; otherwise the active stack still acts,
    // so refresh its reach (Haste/Bless may have changed it).
    if (this.battle.checkWinner()) {
      for (const u of this.battle.units) { const rp = this.rpos.get(u)!; rp.x = u.x; rp.y = u.y; }
      this.finish();
      return;
    }
    const a = this.battle.active;
    if (a) this.reach = this.battle.reachable(a);
  }

  private handleClick(px: number, py: number): void {
    if (this.phase === "over") { this.continueOut(); return; }
    if (this.phase !== "player") return;
    // spell selection takes over the grid/buttons while active
    if (this.pickingSpell) { this.handleSpellMenuClick(px, py); return; }
    if (this.casting) { this.handleCastTargetClick(px, py); return; }
    // buttons
    if (pointInRect(px, py, this.lay.btnWait)) { this.doWait(); return; }
    if (pointInRect(px, py, this.lay.btnDefend)) { this.doDefend(); return; }
    if (this.lay.btnCast && pointInRect(px, py, this.lay.btnCast)) { this.openSpellMenu(); return; }
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

  // The enemy commander may cast one spell per round before its stack acts.
  // Returns true if the cast ended the battle.
  private tryEnemyCast(): boolean {
    const dec = aiCastDecision(this.battle);
    if (!dec) return false;
    const { spell, target } = dec;
    const eff = this.battle.castSpell(spell, target);
    this.battle.enemyMana -= spell.cost;
    this.battle.enemyCastThisRound = true;
    Sfx.cast();
    this.flashBanner(`${this.enemyName} casts ${spell.name}`);
    if (eff.damage) {
      this.pushFloater(target, `-${eff.damage}`, "#c08aff");
      if (eff.killed) this.pushFloater(target, `${eff.killed} slain`, "#ffd0a0", 18);
    } else {
      this.pushFloater(target, spell.name, "#9ad0ff");
    }
    return this.battle.checkWinner();
  }

  private runEnemy(): void {
    const u = this.battle.active!;
    if (this.tryEnemyCast()) {
      for (const x of this.battle.units) { const rp = this.rpos.get(x)!; rp.x = x.x; rp.y = x.y; }
      this.finish();
      return;
    }
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
      if (u.side === "defender" && this.tryEnemyCast()) break;
      const action = aiDecide(this.battle, u);
      if (action.kind === "shoot") this.battle.attack(u, action.target, true);
      else if (action.kind === "attack") {
        if (action.from.x !== u.x || action.from.y !== u.y) {
          this.battle.moveTo(u, action.from.x, action.from.y);
          this.battle.applyHazard(u);
        }
        if (u.count > 0 && action.target.count > 0) this.battle.attack(u, action.target, false);
      } else if (action.kind === "move") {
        this.battle.moveTo(u, action.to.x, action.to.y);
        this.battle.applyHazard(u);
      }
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
    if (this.phase === "player") { this.drawPreview(ctx); this.drawTerrainTip(ctx); }
    this.drawBanner(ctx);
    this.drawControls(ctx);
    if (this.casting) this.drawCastTargets(ctx);
    if (this.pickingSpell) this.drawSpellMenu(ctx);
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

  // Terrain features: impassable boulders/trees/craters and slowing marshes.
  private drawObstacles(ctx: CanvasRenderingContext2D): void {
    const { gx, gy, cell } = this.lay;
    for (const [k, kind] of this.battle.features) {
      const x = k % BW, y = Math.floor(k / BW);
      const sx = gx + x * cell, sy = gy + y * cell;
      if (kind === "marsh") this.drawMarsh(ctx, sx, sy, cell);
      else if (kind === "quicksand") this.drawQuicksand(ctx, sx, sy, cell);
      else if (kind === "fire") this.drawFire(ctx, sx, sy, cell);
      else if (kind === "tree") this.drawTree(ctx, sx, sy, cell);
      else if (kind === "crater") this.drawCrater(ctx, sx, sy, cell);
      else this.drawBoulder(ctx, sx, sy, cell);
    }
  }

  private groundShadow(ctx: CanvasRenderingContext2D, cx: number, by: number, rw: number): void {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(cx, by, rw, rw * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBoulder(ctx: CanvasRenderingContext2D, sx: number, sy: number, cell: number): void {
    const cx = sx + cell / 2, cy = sy + cell * 0.58;
    const rw = cell * 0.36, rh = cell * 0.28;
    this.groundShadow(ctx, cx, sy + cell - 5, rw);
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

  private drawTree(ctx: CanvasRenderingContext2D, sx: number, sy: number, cell: number): void {
    const cx = sx + cell / 2;
    const baseY = sy + cell - 5;
    this.groundShadow(ctx, cx, baseY, cell * 0.3);
    // trunk
    ctx.fillStyle = "#6b4a24";
    ctx.fillRect(cx - cell * 0.05, sy + cell * 0.5, cell * 0.1, cell * 0.42);
    // layered pine canopy
    const tip = sy + cell * 0.08;
    const tiers = [0.42, 0.6, 0.8];
    for (let i = 0; i < tiers.length; i++) {
      const w = cell * (0.18 + i * 0.13);
      const top = tip + (sy + cell * 0.58 - tip) * (i / tiers.length);
      const bot = sy + cell * tiers[i];
      ctx.fillStyle = i % 2 ? "#3f7a37" : "#356b2f";
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(cx - w, bot);
      ctx.lineTo(cx + w, bot);
      ctx.closePath();
      ctx.fill();
    }
    // highlight
    ctx.fillStyle = "rgba(180,230,150,0.35)";
    ctx.beginPath();
    ctx.moveTo(cx, tip);
    ctx.lineTo(cx - cell * 0.06, sy + cell * 0.34);
    ctx.lineTo(cx + cell * 0.02, sy + cell * 0.34);
    ctx.closePath();
    ctx.fill();
  }

  private drawCrater(ctx: CanvasRenderingContext2D, sx: number, sy: number, cell: number): void {
    const cx = sx + cell / 2, cy = sy + cell * 0.6;
    const rw = cell * 0.38, rh = cell * 0.24;
    // raised rim
    ctx.fillStyle = "#6a5232";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    // dark pit
    ctx.fillStyle = "#241a10";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw * 0.72, rh * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f0a06";
    ctx.beginPath();
    ctx.ellipse(cx, cy + rh * 0.12, rw * 0.45, rh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMarsh(ctx: CanvasRenderingContext2D, sx: number, sy: number, cell: number): void {
    // flat boggy ground tint
    ctx.fillStyle = "rgba(58,82,52,0.55)";
    ctx.fillRect(sx + 1, sy + 1, cell - 2, cell - 2);
    const cx = sx + cell / 2, cy = sy + cell * 0.62;
    // murky pools
    ctx.fillStyle = "rgba(46,72,78,0.85)";
    ctx.beginPath();
    ctx.ellipse(cx - cell * 0.12, cy, cell * 0.22, cell * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + cell * 0.16, cy + cell * 0.12, cell * 0.16, cell * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    // ripple glints
    ctx.strokeStyle = "rgba(170,200,190,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx - cell * 0.12, cy, cell * 0.12, cell * 0.06, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    // reeds
    ctx.strokeStyle = "#5f7a3a";
    ctx.lineWidth = Math.max(1, cell * 0.03);
    for (let i = -1; i <= 1; i++) {
      const rx = cx + i * cell * 0.18 + cell * 0.05;
      ctx.beginPath();
      ctx.moveTo(rx, sy + cell * 0.8);
      ctx.lineTo(rx + i * cell * 0.04, sy + cell * 0.42);
      ctx.stroke();
    }
  }

  private drawQuicksand(ctx: CanvasRenderingContext2D, sx: number, sy: number, cell: number): void {
    // sandy pit tint
    ctx.fillStyle = "rgba(120,98,54,0.6)";
    ctx.fillRect(sx + 1, sy + 1, cell - 2, cell - 2);
    const cx = sx + cell / 2, cy = sy + cell * 0.56;
    // concentric sinking rings
    const rings: [number, string][] = [
      [0.42, "#9c7e44"],
      [0.30, "#b89a5e"],
      [0.18, "#7a5e30"],
    ];
    for (const [r, col] of rings) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * r, cell * r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // bubbles rising as it churns
    ctx.fillStyle = "rgba(60,44,20,0.8)";
    for (let i = 0; i < 3; i++) {
      const ph = (this.time * 0.6 + i * 0.37) % 1;
      const bx = cx + (i - 1) * cell * 0.16;
      const by = cy + cell * 0.12 - ph * cell * 0.28;
      ctx.beginPath();
      ctx.arc(bx, by, cell * 0.04 * (1 - ph * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFire(ctx: CanvasRenderingContext2D, sx: number, sy: number, cell: number): void {
    // scorched ground
    ctx.fillStyle = "rgba(30,16,10,0.6)";
    ctx.fillRect(sx + 1, sy + 1, cell - 2, cell - 2);
    const cx = sx + cell / 2, base = sy + cell * 0.86;
    // glowing embers
    ctx.fillStyle = "rgba(255,120,30,0.25)";
    ctx.beginPath();
    ctx.ellipse(cx, base, cell * 0.3, cell * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // a few flickering tongues of witchfire
    const tongues = 3;
    for (let i = 0; i < tongues; i++) {
      const off = (i - (tongues - 1) / 2) * cell * 0.2;
      const flick = Math.sin(this.time * 9 + i * 2.1) * cell * 0.05;
      const h = cell * (0.42 + 0.12 * Math.sin(this.time * 7 + i)) ;
      const fx = cx + off + flick;
      // outer flame (orange)
      ctx.fillStyle = "#ff7a1e";
      ctx.beginPath();
      ctx.moveTo(fx - cell * 0.1, base);
      ctx.quadraticCurveTo(fx - cell * 0.12, base - h * 0.5, fx, base - h);
      ctx.quadraticCurveTo(fx + cell * 0.12, base - h * 0.5, fx + cell * 0.1, base);
      ctx.closePath();
      ctx.fill();
      // inner flame (gold), tinted violet for a "witch" feel at the tip
      ctx.fillStyle = "#ffd24a";
      ctx.beginPath();
      ctx.moveTo(fx - cell * 0.05, base);
      ctx.quadraticCurveTo(fx - cell * 0.06, base - h * 0.4, fx, base - h * 0.72);
      ctx.quadraticCurveTo(fx + cell * 0.06, base - h * 0.4, fx + cell * 0.05, base);
      ctx.closePath();
      ctx.fill();
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
    const vs = this.battle.enemyMaxMana > 0
      ? `vs ${this.enemyName}   ✦ ${this.battle.enemyMana}`
      : `vs ${this.enemyName}`;
    textShadow(ctx, vs, 14, topH - 12, "#e8c0a0", "13px 'Trebuchet MS'");
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

  // A one-line label naming the terrain under the cursor (and its effect),
  // shown when not hovering an enemy (which gets the damage forecast instead).
  private drawTerrainTip(ctx: CanvasRenderingContext2D): void {
    if (this.hover.x < 0) return;
    if (this.battle.unitAt(this.hover.x, this.hover.y)) return;
    const f = this.battle.featureAt(this.hover.x, this.hover.y);
    if (!f) return;
    const label: Record<typeof f, string> = {
      boulder: "Boulder — impassable",
      tree: "Trees — impassable",
      crater: "Crater — impassable",
      marsh: "Marsh — slow (costs 2)",
      quicksand: "Quicksand — slow, sinks",
      fire: "Witchfire — burns",
    };
    const { gx, gy, cell, topH, iniH, vw, vh, ctrlH } = this.lay;
    const str = label[f];
    ctx.font = "12px 'Trebuchet MS'";
    const w = Math.ceil(ctx.measureText(str).width) + 20;
    const h = 24;
    let px = gx + this.hover.x * cell + cell / 2 - w / 2;
    let py = gy + this.hover.y * cell - h - 4;
    px = Math.min(Math.max(6, px), vw - w - 6);
    py = Math.min(Math.max(topH + iniH + 4, py), vh - ctrlH - h - 6);
    glass(ctx, px, py, w, h, 6, 0.78);
    text(ctx, str, px + w / 2, py + 16, "#f2e4c0", "12px 'Trebuchet MS'", "center");
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
    if (this.lay.btnCast) {
      const hero = this.app.state.hero;
      const canCast = enabled && !this.battle.castThisRound
        && hero.spells.some((s) => hero.mana >= SPELLS[s].cost);
      button(ctx, { ...this.lay.btnCast, enabled: canCast }, false);
      text(ctx, `✦ ${hero.mana}/${hero.maxMana}`, this.lay.btnCast.x + this.lay.btnCast.w / 2,
        this.lay.btnCast.y - 6, "#c8a0ff", "11px 'Trebuchet MS'", "center");
    }
    button(ctx, { ...this.lay.btnAuto, enabled }, false);
    button(ctx, { ...this.lay.btnFlee, enabled }, false);
  }

  // The pop-up spell list shown while choosing which spell to cast.
  private drawSpellMenu(ctx: CanvasRenderingContext2D): void {
    const hero = this.app.state.hero;
    for (const { sid, rect } of this.spellMenuRects()) {
      const sp = SPELLS[sid];
      button(ctx, { ...rect, label: `${sp.name}  (${sp.cost})`, enabled: hero.mana >= sp.cost }, false);
    }
  }

  // Outline the stacks that are valid targets for the spell being aimed.
  private drawCastTargets(ctx: CanvasRenderingContext2D): void {
    const sp = SPELLS[this.casting!];
    const wantSide = sp.target === "enemy" ? "defender" : "attacker";
    const { cell } = this.lay;
    ctx.strokeStyle = "#c8a0ff";
    ctx.lineWidth = 3;
    for (const u of this.battle.units) {
      if (u.count <= 0 || u.side !== wantSide) continue;
      const c = this.cellCenter(u.x, u.y);
      ctx.strokeRect(c.x - cell / 2 + 2, c.y - cell / 2 + 2, cell - 4, cell - 4);
    }
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
