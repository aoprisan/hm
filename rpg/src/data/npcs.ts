// NPCs that populate the adventure map: a name, a procedural portrait, and a
// declarative dialogue tree. The opening line is chosen by walking `entries` in
// order and taking the first whose `requires` holds (an entry without `requires`
// is the default), so an NPC greets you differently as the story advances.
import { DialogueCondition, DialogueNode } from "./dialogue";
import { FactionId } from "./factions";

export type PortraitKind = "elder" | "sage" | "villager";

export interface NpcDef {
  id: string;
  name: string;
  portrait: PortraitKind;
  faction?: FactionId; // optional palette tint hint
  entries: { requires?: DialogueCondition; node: string }[];
  nodes: Record<string, DialogueNode>;
}

export const NPCS: Record<string, NpcDef> = {
  // ---- Elder Aldous: opens the chapter by sending you to the seer ----
  elder: {
    id: "elder",
    name: "Elder Aldous",
    portrait: "elder",
    entries: [
      { requires: { kind: "questAvailable", quest: "q_meet" }, node: "offer" },
      { node: "encourage" },
    ],
    nodes: {
      offer: {
        id: "offer",
        text:
          "Brave one! A cold shadow creeps from the northeast and our harvests wither. " +
          "The seer Mirelle keeps a vigil along the eastern road — go to her, and learn " +
          "what stirs against us.",
        choices: [
          { label: "I will seek her out.", effects: [{ kind: "startQuest", quest: "q_meet" }], next: "thanks" },
          { label: "Another time.", next: "encourage" },
        ],
      },
      thanks: {
        id: "thanks",
        text: "Bless you. Follow the road east; Mirelle is not hard to find for those who look.",
      },
      encourage: {
        id: "encourage",
        text:
          "The seer Mirelle waits along the eastern road. Sunhaven's hope rides with you — " +
          "do not tarry.",
      },
    },
  },

  // ---- Mirelle the Seer: hands out the rest of the chapter ----
  sage: {
    id: "sage",
    name: "Mirelle the Seer",
    portrait: "sage",
    entries: [
      { requires: { kind: "questActive", quest: "q_meet" }, node: "reveal" },
      { requires: { kind: "questActive", quest: "q_troll" }, node: "troll" },
      { requires: { kind: "questActive", quest: "q_beacon" }, node: "beacon" },
      { requires: { kind: "questActive", quest: "q_keep" }, node: "keep" },
      { requires: { kind: "questComplete", quest: "q_keep" }, node: "peace" },
      { node: "cryptic" },
    ],
    nodes: {
      // Reached while q_meet is active. The talk itself completes q_meet (handled
      // by the scene firing a "talk" event before this node is shown), which chains
      // q_troll into the active log — so this line introduces the troll hunt.
      reveal: {
        id: "reveal",
        text:
          "Aldous sent you — good. The omens are plain: a dire troll has crawled from " +
          "Thornwood and feeds on the valley folk. Slay the beast in the eastern wilds, " +
          "and I will read you the rest.",
        choices: [
          { label: "I'll hunt it down.", effects: [{ kind: "completeQuest", quest: "q_meet" }] },
        ],
      },
      troll: {
        id: "troll",
        text: "The troll still hunts the eastern wood. Find it, and do not let it corner you in the marsh.",
      },
      beacon: {
        id: "beacon",
        text:
          "The troll is dead — well done. Now climb to the old watchtower on the northern " +
          "rise and rekindle its beacon; only then will the dark lord's wards fail.",
      },
      keep: {
        id: "keep",
        text:
          "The beacon burns and the keep stands unguarded by sorcery. Storm it, hero — " +
          "the shadow over Sunhaven ends with you.",
      },
      peace: {
        id: "peace",
        text: "The vale is bright again, and your name with it. Rest now — you have earned the calm.",
      },
      cryptic: {
        id: "cryptic",
        text:
          "I read shadows for the folk of Sunhaven. If you would help, the Elder Aldous by " +
          "the castle gate will set your feet on the path.",
      },
    },
  },

  // ---- A woodcutter: pure flavor with a small one-time gift ----
  woodcutter: {
    id: "woodcutter",
    name: "Garrick the Woodcutter",
    portrait: "villager",
    entries: [
      { requires: { kind: "flag", flag: "woodcutterThanked" }, node: "again" },
      { node: "gift" },
    ],
    nodes: {
      gift: {
        id: "gift",
        text:
          "Hoi! You're the one off to face the keep? Here — a few coins I've saved. Buy your " +
          "soldiers a hot meal on me, and send that dark lord packing.",
        choices: [
          {
            label: "Thank you, Garrick.",
            effects: [
              { kind: "giveResource", resource: "gold", amount: 300 },
              { kind: "setFlag", flag: "woodcutterThanked" },
            ],
          },
        ],
      },
      again: {
        id: "again",
        text: "Mind the marsh out east — swallowed my best axe, it did. Luck to you, hero.",
      },
    },
  },
};
