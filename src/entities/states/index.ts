import { falling } from "./falling";
import type { LemmingState, StateName } from "./LemmingState";
import { walking } from "./walking";

export type { LemmingState, StateName } from "./LemmingState";

/** Registry used for transitions, so state modules never import one another. */
export const STATES: Readonly<Record<StateName, LemmingState>> = {
  falling,
  walking,
};
