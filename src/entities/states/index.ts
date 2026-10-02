import { building } from "./building";
import { digging } from "./digging";
import { falling } from "./falling";
import { jumping } from "./jumping";
import type { LemmingState, StateName } from "./LemmingState";
import { walking } from "./walking";

export type { LemmingState, StateName } from "./LemmingState";

/** Registry used for transitions, so state modules never import one another. */
export const STATES: Readonly<Record<StateName, LemmingState>> = {
  falling,
  walking,
  jumping,
  digging,
  building,
};
