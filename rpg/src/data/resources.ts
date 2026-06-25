// Resource model. HOMM2 has 7 resources; the Knight economy leans on gold/wood/ore.
export type ResourceKind =
  | "gold"
  | "wood"
  | "ore"
  | "mercury"
  | "sulfur"
  | "crystal"
  | "gems";

export const RESOURCE_ORDER: ResourceKind[] = [
  "wood",
  "ore",
  "mercury",
  "sulfur",
  "crystal",
  "gems",
  "gold",
];

export type ResourceBag = Record<ResourceKind, number>;

export function emptyBag(): ResourceBag {
  return { gold: 0, wood: 0, ore: 0, mercury: 0, sulfur: 0, crystal: 0, gems: 0 };
}

export function bag(partial: Partial<ResourceBag>): ResourceBag {
  return { ...emptyBag(), ...partial };
}

export function canAfford(have: ResourceBag, cost: Partial<ResourceBag>): boolean {
  return (Object.keys(cost) as ResourceKind[]).every((k) => have[k] >= (cost[k] ?? 0));
}

export function pay(have: ResourceBag, cost: Partial<ResourceBag>): void {
  for (const k of Object.keys(cost) as ResourceKind[]) have[k] -= cost[k] ?? 0;
}

export function addBag(have: ResourceBag, gain: Partial<ResourceBag>): void {
  for (const k of Object.keys(gain) as ResourceKind[]) have[k] += gain[k] ?? 0;
}

export const RESOURCE_LABEL: Record<ResourceKind, string> = {
  gold: "Gold",
  wood: "Wood",
  ore: "Ore",
  mercury: "Mercury",
  sulfur: "Sulfur",
  crystal: "Crystal",
  gems: "Gems",
};
