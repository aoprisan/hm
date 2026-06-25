// Terrain types for the adventure map. Move cost is in "movement points" per tile
// (a hero has a movement-point budget per turn). Impassable tiles block pathing.
export type TerrainKind =
  | "grass"
  | "dirt"
  | "sand"
  | "water"
  | "forest"
  | "mountain"
  | "rock"
  // expansion terrains used by the later campaign realms
  | "snow"   // frozen north: passable but heavy going
  | "ice"    // frozen lake / glacier road: slick but quick
  | "swamp"  // fetid mire: very slow, saps movement
  | "lava"   // molten rock: impassable
  | "ash";   // scorched wasteland: cracked, dark, passable

export interface TerrainDef {
  kind: TerrainKind;
  passable: boolean;
  moveCost: number; // movement points to enter (for passable terrain)
  name: string;
}

export const TERRAIN: Record<TerrainKind, TerrainDef> = {
  grass: { kind: "grass", passable: true, moveCost: 100, name: "Grass" },
  dirt: { kind: "dirt", passable: true, moveCost: 100, name: "Dirt Road" },
  sand: { kind: "sand", passable: true, moveCost: 150, name: "Sand" },
  forest: { kind: "forest", passable: true, moveCost: 175, name: "Forest" },
  water: { kind: "water", passable: false, moveCost: 0, name: "Water" },
  mountain: { kind: "mountain", passable: false, moveCost: 0, name: "Mountains" },
  rock: { kind: "rock", passable: false, moveCost: 0, name: "Rocks" },
  snow: { kind: "snow", passable: true, moveCost: 150, name: "Snow" },
  ice: { kind: "ice", passable: true, moveCost: 100, name: "Ice" },
  swamp: { kind: "swamp", passable: true, moveCost: 200, name: "Swamp" },
  lava: { kind: "lava", passable: false, moveCost: 0, name: "Lava" },
  ash: { kind: "ash", passable: true, moveCost: 125, name: "Ashlands" },
};
