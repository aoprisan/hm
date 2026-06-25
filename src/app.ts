// App: owns the renderer, input, scene manager and game state, and provides the
// navigation used by scenes (adventure <-> town <-> battle). Scenes import this
// type-only to avoid runtime import cycles.
import { Renderer } from "./engine/renderer";
import { Input } from "./engine/input";
import { SceneManager } from "./engine/scene";
import { GameState } from "./game/state";
import { saveGame, loadSave, deserialize, clearSave } from "./game/persist";
import { Hero } from "./game/hero";
import { Stack } from "./game/army";
import { buildMap1 } from "./data/map1";
import { freshTown } from "./game/state";
import { CREATURES } from "./data/creatures";
import { FactionId, FACTIONS, otherFaction } from "./data/factions";

import { MenuScene } from "./scenes/MenuScene";
import { AdventureScene } from "./scenes/AdventureScene";
import { TownScene } from "./scenes/TownScene";
import { BattleScene, BattleOutcome } from "./scenes/BattleScene";

export class App {
  renderer: Renderer;
  input: Input;
  scenes = new SceneManager();
  state!: GameState;

  constructor(renderer: Renderer, input: Input) {
    this.renderer = renderer;
    this.input = input;
    this.toMenu();
  }

  toMenu(): void {
    this.scenes.replace(new MenuScene(this));
  }

  newGame(factionId: FactionId): void {
    const enemyId = otherFaction(factionId);
    const { map, castle, startX, startY } = buildMap1(factionId, enemyId);
    const f = FACTIONS[factionId];
    const town = freshTown(castle.x, castle.y, factionId);
    const startArmy: Stack[] = f.startArmy.map((s) => ({ ...s }));
    const hero = new Hero(f.heroName, startX, startY, startArmy, 2, 2);
    this.state = new GameState(map, hero, town);
    this.state.pushLog(`${f.heroName} sets out from ${town.name}.`);
    this.state.pushLog("Speak with Elder Aldous by the castle gate.");
    this.save();
    this.scenes.replace(new AdventureScene(this));
  }

  // Resume a saved run. Falls back to the menu if the save is missing/corrupt.
  continueGame(): void {
    const d = loadSave();
    if (!d) { this.toMenu(); return; }
    this.state = deserialize(d);
    this.scenes.replace(new AdventureScene(this));
  }

  // Persist the current run. A finished game clears the save so it isn't
  // resumed; an in-progress one is written to localStorage.
  save(): void {
    if (!this.state) return;
    if (this.state.phase === "playing") saveGame(this.state);
    else clearSave();
  }

  toAdventure(): void {
    this.scenes.replace(new AdventureScene(this));
  }

  openTown(): void {
    this.scenes.replace(new TownScene(this));
  }

  // Start a tactical battle. enemyStacks/atk/def define the foe; onResult fires
  // after the player closes the result screen with whether the hero won.
  startBattle(
    enemyStacks: Stack[],
    enemyAtk: number,
    enemyDef: number,
    enemyName: string,
    onResult: (outcome: BattleOutcome) => void,
  ): void {
    this.scenes.replace(
      new BattleScene(this, enemyStacks, enemyAtk, enemyDef, enemyName, onResult),
    );
  }
}

// re-export for convenience
export { CREATURES };
