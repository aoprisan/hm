// NPCs that populate the adventure map: a name, a procedural portrait, and a
// declarative dialogue tree. The opening line is chosen by walking `entries` in
// order and taking the first whose `requires` holds (an entry without `requires`
// is the default), so an NPC greets you differently as the story advances.
//
// Every chapter follows the same cast shape: a HUB elder by the gate who offers
// the chapter's first quest, a GUIDE who reveals and tracks the hunt/reach/keep
// chain, and a flavor villager with a one-time gift.
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

// ---- shared builders so each chapter's cast stays consistent and terse ----

// A HUB elder who offers the chapter's opening "meet" quest, then nudges you on.
function hub(
  id: string, name: string, meetQuest: string,
  offer: string, encourage: string, accept: string, defer: string,
): NpcDef {
  return {
    id, name, portrait: "elder",
    entries: [
      { requires: { kind: "questAvailable", quest: meetQuest }, node: "offer" },
      { node: "encourage" },
    ],
    nodes: {
      offer: {
        id: "offer", text: offer,
        choices: [
          { label: accept, effects: [{ kind: "startQuest", quest: meetQuest }], next: "thanks" },
          { label: defer, next: "encourage" },
        ],
      },
      thanks: { id: "thanks", text: encourage },
      encourage: { id: "encourage", text: encourage },
    },
  };
}

// A GUIDE who reveals the chapter (completing the meet quest, which chains into
// the hunt) and then tracks the hunt → reach → keep chain with situational lines.
function guide(
  id: string, name: string,
  q: { meet: string; hunt: string; reach: string; keep: string },
  lines: { reveal: string; accept: string; hunt: string; reach: string; keep: string; done: string; cryptic: string },
): NpcDef {
  return {
    id, name, portrait: "sage",
    entries: [
      { requires: { kind: "questActive", quest: q.meet }, node: "reveal" },
      { requires: { kind: "questActive", quest: q.hunt }, node: "hunt" },
      { requires: { kind: "questActive", quest: q.reach }, node: "reach" },
      { requires: { kind: "questActive", quest: q.keep }, node: "keep" },
      { requires: { kind: "questComplete", quest: q.keep }, node: "done" },
      { node: "cryptic" },
    ],
    nodes: {
      reveal: {
        id: "reveal", text: lines.reveal,
        choices: [{ label: lines.accept, effects: [{ kind: "completeQuest", quest: q.meet }] }],
      },
      hunt: { id: "hunt", text: lines.hunt },
      reach: { id: "reach", text: lines.reach },
      keep: { id: "keep", text: lines.keep },
      done: { id: "done", text: lines.done },
      cryptic: { id: "cryptic", text: lines.cryptic },
    },
  };
}

// A flavor villager who hands over a one-time gift, then offers a parting line.
function giver(
  id: string, name: string, flag: string, resource: "gold" | "wood" | "ore" | "crystal", amount: number,
  gift: string, accept: string, again: string,
): NpcDef {
  return {
    id, name, portrait: "villager",
    entries: [
      { requires: { kind: "flag", flag }, node: "again" },
      { node: "gift" },
    ],
    nodes: {
      gift: {
        id: "gift", text: gift,
        choices: [{
          label: accept,
          effects: [{ kind: "giveResource", resource, amount }, { kind: "setFlag", flag }],
        }],
      },
      again: { id: "again", text: again },
    },
  };
}

export const NPCS: Record<string, NpcDef> = {
  // ============================================================
  // Chapter 1 — The Vale of Sunhaven
  // ============================================================
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
          "this first shadow over Sunhaven ends with you.",
      },
      peace: {
        id: "peace",
        text:
          "The vale is bright again — but the omens run on. This shadow was only the first; " +
          "darker realms lie north and east, and your road does not end here.",
      },
      cryptic: {
        id: "cryptic",
        text:
          "I read shadows for the folk of Sunhaven. If you would help, the Elder Aldous by " +
          "the castle gate will set your feet on the path.",
      },
    },
  },

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

  // ============================================================
  // Chapter 2 — Frostmere Reach
  // ============================================================
  monk: hub(
    "monk", "Brother Caedmon", "l2_meet",
    "You came north — thank the saints. The dead climb out of the glacier each night, and " +
      "my prayers no longer hold them. Yetra the Trapper roams the snowfields; she alone can " +
      "guide you across the ice. Find her.",
    "Yetra ranges the central snowfields. Follow the packed-snow trail and watch the ice — " +
      "it is thin where the barrow-cold gnaws it.",
    "I will find her.", "Not yet.",
  ),
  trapper: guide(
    "trapper", "Yetra the Trapper",
    { meet: "l2_meet", hunt: "l2_pack", reach: "l2_shrine", keep: "l2_keep" },
    {
      reveal:
        "Caedmon's monk sent you? Then listen. The barrow-cold has driven a wolf-pack rabid — " +
        "they run my traplines and savage anything warm. Break the pack, and I'll show you how " +
        "to thaw the barrow itself.",
      accept: "Where do the wolves run?",
      hunt: "The pack dens on the central ice. Nine strong and starving — hit them together or not at all.",
      reach:
        "Pack's broken — good. Now wake the Frostfont on the northern ice; its meltwater is the " +
        "one thing the barrow-king's frost cannot abide. Stand on the spring and it will rouse.",
      keep:
        "The Frostfont runs and the barrow's wards drip away. Storm the Barrow in the northeast " +
        "and put that crowned corpse back under the ice for good.",
      done: "The Barrow is still and the snow falls clean again. But the cold ran south from somewhere darker...",
      cryptic: "I trap and I track. Brother Caedmon at the gate will tell you why you're really here.",
    },
  ),
  iceFisher: giver(
    "iceFisher", "Old Halvard", "halvardThanked", "crystal", 3,
    "Eh? A living soul, out here! Take these rime-crystals, friend — I cut them from the lake and " +
      "they fetch nothing from the dead. Maybe your sorcerers can use them.",
    "Thank you, Halvard.",
    "Stay off the blue ice, hero — that's where the lake breathes. Lost two dogs to it.",
  ),

  // ============================================================
  // Chapter 3 — The Sunder Marsh
  // ============================================================
  witch: hub(
    "witch", "Mosswife Hagar", "l3_meet",
    "Heh — a dry boot in my wet country! Listen, soldier: a coven works the deep mire, raising " +
      "trolls and worse from the muck. I'm too old to pole the channels now. Find Quill the " +
      "Ferryman — he'll carry you where the coven hides.",
    "Quill works the central channels. Keep to the dry hummocks; the swamp drinks the heavy-footed.",
    "I'll find the ferryman.", "Later, witch.",
  ),
  ferryman: guide(
    "ferryman", "Quill the Ferryman",
    { meet: "l3_meet", hunt: "l3_hunt", reach: "l3_idol", keep: "l3_keep" },
    {
      reveal:
        "Hagar sent you down my channels, did she? Then earn the ride. The coven raised a warband " +
        "of bog-trolls — they drag folk off the hummocks at dusk. Put them down, and I'll pole you " +
        "to the coven's own door.",
      accept: "Where's the warband?",
      hunt: "Trolls hole up on the central hummocks. Five of them, regenerating — bring fire if you've got it.",
      reach:
        "Trolls are sunk — good riddance. The coven's wards anchor to a sunken idol on the far " +
        "hummock. Reach it, lay your hand on it, and the fen-wards gutter out.",
      keep:
        "Idol's cold and the wards are dead. I'll pole you to the Mire fortress in the northeast — " +
        "storm it and wring the dark magic out of my marsh.",
      done: "The water runs clean — well, cleaner. But the coven answered to something east of here, in the fire...",
      cryptic: "I just work the channels, friend. Old Hagar by the gate is the one with the schemes.",
    },
  ),
  frogman: giver(
    "frogman", "Old Squelch", "squelchThanked", "ore", 5,
    "Glub — a walker! Here, walker, take this bog-iron. Pulled it from a drowned cart, I did. No " +
      "use to me down in the wet. Maybe you melt it into something sharp, yes?",
    "Thank you, Squelch.",
    "Mind the channels, walker. The coven puts eyes in the water. Watching, always watching.",
  ),

  // ============================================================
  // Chapter 4 — The Emberwastes
  // ============================================================
  emberseer: hub(
    "emberseer", "Pyra the Emberseer", "l4_meet",
    "You feel that? The lava-tides are climbing — the dragon-lords on the Cinder Spire are waking. " +
      "I read the embers, not the paths; for those you want Cinder-Jack, the prospector. He walks " +
      "the ash flats and knows which crust will hold you over the fire.",
    "Cinder-Jack works the central flats. Step only where the ash is grey — the black crust is " +
      "thin, and beneath it is the burning.",
    "I'll find the prospector.", "In a moment.",
  ),
  prospector: guide(
    "prospector", "Cinder-Jack",
    { meet: "l4_meet", hunt: "l4_hunt", reach: "l4_forge", keep: "l4_keep" },
    {
      reveal:
        "Pyra sent you down to me? Hah. Then here's the lay of it: a fire-drake's taken the central " +
        "flats, it and a flight of harpies, and they've burned out three of my prospect camps. Kill " +
        "the drake, and I'll show you the old forge that can save your hide on the Spire.",
      accept: "Where's the drake?",
      hunt: "Drake hunts the open flats, harpies wheeling round it. Big, but slow to turn — flank it.",
      reach:
        "Drake's down? You're tougher than you look. Now get to the Obsidian Forge on the high shelf " +
        "and quench your steel — dragonfire shears any blade that isn't tempered against it.",
      keep:
        "Blades tempered, good. The Cinder Spire's in the northeast, dragon-lords roosting on top. " +
        "Climb it and cast them down before they take wing over the whole waste.",
      done: "The Spire's cold and the lava's sinking. But the dragon-lords served a darker throne, north and east...",
      cryptic: "I'm just a prospector, friend. Pyra the Emberseer at the gate is the one who reads the doom.",
    },
  ),
  smith: giver(
    "smith", "Goro the Smith", "goroThanked", "ore", 7,
    "Heat and hammer, that's all that lives out here. Here — good ore, the last of my stock. Take it " +
      "to the Obsidian Forge up the road; better you make something of it than the dragons melt it.",
    "Thank you, Goro.",
    "When you reach the forge, work the bellows twice before you quench. Trust an old smith on that.",
  ),

  // ============================================================
  // Chapter 5 — The Shadowmarch (finale)
  // ============================================================
  oracle: hub(
    "oracle", "The Last Oracle", "l5_meet",
    "So. The wards you woke — beacon and font, idol and forge — all of it was the road to this. The " +
      "Dark Lord sits the Obsidian Throne beyond the black moat. I have seen the end but cannot walk " +
      "it. Gravewarden Sela can: she has crossed the Shadowmarch and returned. Find her.",
    "Sela walks the middle waste. The whole campaign's wards travel with you now — they are the only " +
      "key that will open the Shadow Gate.",
    "I will find the Gravewarden.", "Let me gather myself.",
  ),
  warden: guide(
    "warden", "Gravewarden Sela",
    { meet: "l5_meet", hunt: "l5_hunt", reach: "l5_gate", keep: "l5_keep" },
    {
      reveal:
        "The Oracle sent you to me at the end of all roads. Good — you'll need a guide who fears " +
        "nothing left to fear. The Dark Lord's champion, a death-wight, holds the waste. Destroy it, " +
        "and the throne-causeway opens to us.",
      accept: "Where does the wight stand?",
      hunt: "The death-wight stands in the middle waste, liches and vampires at its flanks. This is the hardest " +
        "fight before the throne — spend everything.",
      reach:
        "The wight is unmade. Now reach the Shadow Gate before the causeway — the wards you have carried " +
        "since Sunhaven will crack its last sigil as you near. Stand before it.",
      keep:
        "The Gate is open. Cross the causeway and storm the Obsidian Throne. End the Dark Lord, hero — " +
        "end the whole long shadow, here, now, forever.",
      done: "It is over. The shadow is lifted from every realm. The bards will not have words enough for you.",
      cryptic: "I guard the road's end. The Last Oracle at the gate will tell you how you came to walk it.",
    },
  ),
  ghostKnight: giver(
    "ghostKnight", "Sir Edran's Shade", "edranThanked", "gold", 1000,
    "Hold, living one. I am Edran, who fell here an age ago and could not rest. Take my war-chest — " +
      "gold is no weight to the dead. Spend it, and let my old sword-arm ride with yours to the Throne.",
    "I am honored, Sir Edran.",
    "When you take the Throne, speak my name once. That is all the rest I ask.",
  ),
};
