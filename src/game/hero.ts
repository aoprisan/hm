// The player's hero: position, movement budget, army and combat bonuses.
import { Army, makeArmy, Stack } from "./army";
import { PathTile } from "./pathfind";
import { SpellId } from "../data/spells";

export class Hero {
  name: string;
  x: number; // tile
  y: number;
  fx: number; // smooth (float) tile position for animation
  fy: number;
  facing: 1 | -1 = 1; // 1 = right, -1 = left
  maxMovePoints = 1500;
  movePoints = 1500;
  army: Army;
  attack: number;
  defense: number;
  scouting = 4;
  level = 1;
  experience = 0;
  // spell points spent casting in battle; refilled each new day. Spells the
  // hero has learned at the Mage Guild live in `spells` (see data/spells).
  mana = 10;
  maxMana = 10;
  // spells learned at the Mage Guild, castable in battle (see data/spells).
  spells: SpellId[] = [];
  // active path being walked
  path: PathTile[] = [];

  constructor(name: string, x: number, y: number, army: Stack[], attack = 2, defense = 2) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.fx = x;
    this.fy = y;
    this.army = makeArmy(army);
    this.attack = attack;
    this.defense = defense;
  }

  resetMovement(): void {
    this.movePoints = this.maxMovePoints;
    this.mana = this.maxMana;
  }

  // Total experience needed to reach the next level (the gainExp threshold).
  expForNextLevel(): number {
    return this.level * 1000;
  }

  gainExp(n: number): void {
    this.experience += n;
    while (this.experience >= this.level * 1000) {
      this.experience -= this.level * 1000;
      this.level++;
      // alternate stat gains
      if (this.level % 2 === 0) this.attack++;
      else this.defense++;
    }
  }
}
