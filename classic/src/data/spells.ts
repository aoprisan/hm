// Combat spells taught by the Mage Guild and cast by the hero during battle.
// Kept deliberately small: a nuke, two single-stack buffs and a heal. Casting
// costs the hero mana (refilled each new day); see game/hero + game/combat.
export type SpellId = "lightning" | "bless" | "haste" | "heal";

export interface Spell {
  id: SpellId;
  name: string;
  desc: string;
  cost: number;                 // mana spent to cast
  kind: "damage" | "buff" | "heal";
  target: "enemy" | "ally";
  power: number;                // damage (lightning), hp restored (heal), +speed (haste)
}

export const SPELLS: Record<SpellId, Spell> = {
  lightning: {
    id: "lightning", name: "Lightning Bolt",
    desc: "Strikes a foe for heavy damage, ignoring armor.",
    cost: 4, kind: "damage", target: "enemy", power: 60,
  },
  bless: {
    id: "bless", name: "Bless",
    desc: "An allied stack deals maximum damage this round.",
    cost: 3, kind: "buff", target: "ally", power: 0,
  },
  haste: {
    id: "haste", name: "Haste",
    desc: "An allied stack gains +2 speed this round.",
    cost: 3, kind: "buff", target: "ally", power: 2,
  },
  heal: {
    id: "heal", name: "Heal",
    desc: "Mend an allied stack, restoring health and felled troops.",
    cost: 4, kind: "heal", target: "ally", power: 50,
  },
};

// The spells the Mage Guild offers to learn.
export const GUILD_SPELLS: SpellId[] = ["lightning", "bless", "haste", "heal"];
