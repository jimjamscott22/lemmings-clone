import { BOMB_FUSE } from "../config";
import type { Lemming } from "../entities/Lemming";
import type { StateName } from "../entities/states";
import type { World } from "../entities/World";

export type SkillId = "climber" | "floater" | "bomber" | "blocker" | "basher" | "miner";

/** A job or upgrade the player gives to one lemming by clicking it. Each assignment spends one charge. */
export interface Skill {
  readonly id: SkillId;
  readonly name: string;
  /** Keyboard code that selects the skill. */
  readonly key: string;
  readonly hint: string;
  canAssign(lemming: Lemming): boolean;
  assign(lemming: Lemming, world: World): void;
}

/** States that can be interrupted by a new job: on the ground, under the lemming's own control. */
const INTERRUPTIBLE: ReadonlySet<StateName> = new Set(["walking", "digging", "building", "bashing", "mining"]);

/** Still in play and not already on its way out. */
const alive = (l: Lemming) => !l.done && l.state.name !== "exiting" && l.state.name !== "splatting";

/** A job that replaces the lemming's current state. */
function job(state: StateName): Pick<Skill, "canAssign" | "assign"> {
  return {
    canAssign: (l) => INTERRUPTIBLE.has(l.state.name) && l.state.name !== state,
    assign: (l, world) => l.setState(state, world),
  };
}

export const SKILLS: Readonly<Record<SkillId, Skill>> = {
  climber: {
    id: "climber",
    name: "Climber",
    key: "Digit3",
    hint: "Climbs walls instead of turning around (permanent)",
    canAssign: (l) => alive(l) && !l.climber,
    assign: (l) => (l.climber = true),
  },
  floater: {
    id: "floater",
    name: "Floater",
    key: "Digit4",
    hint: "Opens an umbrella and survives any fall (permanent)",
    canAssign: (l) => alive(l) && !l.floater,
    assign: (l) => (l.floater = true),
  },
  bomber: {
    id: "bomber",
    name: "Bomber",
    key: "Digit5",
    hint: `Explodes after ${BOMB_FUSE} seconds, blasting nearby terrain`,
    canAssign: (l) => alive(l) && l.fuse === null,
    assign: (l) => (l.fuse = BOMB_FUSE),
  },
  blocker: { id: "blocker", name: "Blocker", key: "Digit6", hint: "Stands still and turns others around", ...job("blocking") },
  basher: { id: "basher", name: "Basher", key: "Digit7", hint: "Tunnels sideways through dirt and bridge", ...job("bashing") },
  miner: { id: "miner", name: "Miner", key: "Digit8", hint: "Digs a staircase diagonally down", ...job("mining") },
};

export const SKILL_ORDER: readonly SkillId[] = ["climber", "floater", "bomber", "blocker", "basher", "miner"];
