// App: owns the renderer, input, scene manager and game state, and provides the
// navigation used by scenes (adventure <-> town <-> battle). Scenes import this
// type-only to avoid runtime import cycles.
import { Renderer } from "./engine/renderer";
import { Input } from "./engine/input";
import { SceneManager } from "./engine/scene";
import { GameState } from "./game/state";
import { Hero } from "./game/hero";
import { Stack } from "./game/army";
import { buildMap1 } from "./data/map1";
import { freshTown } from "./game/state";
import { CREATURES } from "./data/creatures";

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
    this.newGame();
  }

  newGame(): void {
    const { map, startX, startY } = buildMap1();
    const town = freshTown(5, 20);
    const startArmy: Stack[] = [
      { id: "peasant", count: 20 },
      { id: "archer", count: 6 },
    ];
    const hero = new Hero("Sir Roland", startX, startY, startArmy, 2, 2);
    this.state = new GameState(map, hero, town);
    this.state.pushLog("Sir Roland sets out from Sunhaven.");
    this.scenes.replace(new AdventureScene(this));
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
