import type { Lemming } from "../Lemming";
import type { World } from "../World";

/**
 * One node of the lemming finite state machine. States are stateless singletons:
 * per-lemming data (velocity, timers, direction) lives on the Lemming itself, and
 * transitions go through `lemming.setState(name)` so states never import each other.
 */
export interface LemmingState {
  readonly name: StateName;
  /** Called once on entry, after `stateTime` has been reset. */
  enter?(lemming: Lemming, world: World): void;
  /** Advance one fixed simulation step. */
  update(lemming: Lemming, world: World, dt: number): void;
}

export type StateName = "falling" | "walking";
