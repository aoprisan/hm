// Declarative dialogue trees for NPCs. Everything here is plain data (no embedded
// functions) so trees serialize trivially and stay save-safe; all branching is
// routed through quest state and story flags evaluated by GameState.
import { ResourceKind } from "./resources";

// A gate on a dialogue choice or an NPC's opening line.
export type DialogueCondition =
  | { kind: "questActive"; quest: string }
  | { kind: "questComplete"; quest: string }
  | { kind: "questAvailable"; quest: string } // neither active nor completed
  | { kind: "flag"; flag: string; value?: boolean }
  | { kind: "hasArtifact"; artifact: string }; // reserved for Phase 3 (gear)

// A consequence of picking a choice. Applied in order by the scene/state.
export type DialogueEffect =
  | { kind: "startQuest"; quest: string }
  | { kind: "completeQuest"; quest: string }
  | { kind: "setFlag"; flag: string; value?: boolean }
  | { kind: "giveResource"; resource: ResourceKind; amount: number }
  | { kind: "giveExp"; amount: number };

export interface DialogueChoice {
  label: string;
  requires?: DialogueCondition; // hidden when unmet
  effects?: DialogueEffect[];
  next?: string;                // node id to advance to; absent → close
}

export interface DialogueNode {
  id: string;
  text: string;                 // the NPC's line
  choices?: DialogueChoice[];   // absent → a single "Farewell" that closes
}
