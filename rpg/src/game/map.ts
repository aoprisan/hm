// Adventure map model: terrain grid + interactive objects.
import { TerrainKind, TERRAIN } from "../data/terrain";
import { ResourceKind } from "../data/resources";
import { Stack } from "./army";
import { FactionId } from "../data/factions";

export type Owner = "player" | "enemy" | "neutral";

export type ObjType =
  | "castle"
  | "stronghold"
  | "mine"
  | "resource"
  | "chest"
  | "monster"
  | "tree"
  | "rock"
  | "sign"
  | "npc";

export interface MapObject {
  id: number;
  type: ObjType;
  x: number;
  y: number;
  owner?: Owner;
  // mine
  mineKind?: ResourceKind;
  mineAmount?: number;
  // resource pile / chest
  resKind?: ResourceKind;
  amount?: number;
  // guard army (monster stack, stronghold, or guarded mine)
  guard?: Stack[];
  // reward picked up after defeating a lone monster stack
  reward?: Partial<Record<ResourceKind, number>>;
  name?: string;
  text?: string; // signpost text
  visited?: boolean;
  variant?: number; // decorative variation
  faction?: FactionId; // castle / stronghold castle type (drives its art tint)
  npcId?: string; // links a placed NPC to its definition / dialogue (data/npcs)
  questId?: string; // tags an object as a quest target (a slain stack, a goal)
}

export function tileKey(x: number, y: number): number {
  return y * 100000 + x;
}

export class GameMap {
  readonly width: number;
  readonly height: number;
  tiles: TerrainKind[];
  objects: MapObject[];
  private byTile = new Map<number, MapObject>();

  constructor(width: number, height: number, tiles: TerrainKind[], objects: MapObject[]) {
    this.width = width;
    this.height = height;
    this.tiles = tiles;
    this.objects = objects;
    this.reindex();
  }

  reindex(): void {
    this.byTile.clear();
    for (const o of this.objects) this.byTile.set(tileKey(o.x, o.y), o);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  terrainAt(x: number, y: number): TerrainKind {
    if (!this.inBounds(x, y)) return "rock";
    return this.tiles[y * this.width + x];
  }

  objectAt(x: number, y: number): MapObject | undefined {
    return this.byTile.get(tileKey(x, y));
  }

  removeObject(obj: MapObject): void {
    const i = this.objects.indexOf(obj);
    if (i >= 0) this.objects.splice(i, 1);
    this.byTile.delete(tileKey(obj.x, obj.y));
  }

  // Can a hero stand-and-pass-through this tile? (used for path transit)
  passableForTransit(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    if (!TERRAIN[this.terrainAt(x, y)].passable) return false;
    const o = this.objectAt(x, y);
    if (!o) return true;
    // Pickups are walk-over; everything else blocks transit.
    return o.type === "resource" || o.type === "chest" || o.type === "sign";
  }

  // A tile that can be a movement *destination* even if it blocks transit
  // (you step onto/into a castle, mine, or monster to interact with it).
  isInteractiveGoal(x: number, y: number): boolean {
    const o = this.objectAt(x, y);
    if (!o) return false;
    return (
      o.type === "castle" ||
      o.type === "stronghold" ||
      o.type === "mine" ||
      o.type === "monster" ||
      o.type === "npc"
    );
  }

  moveCost(x: number, y: number): number {
    return TERRAIN[this.terrainAt(x, y)].moveCost;
  }
}
