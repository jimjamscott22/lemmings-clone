import { bashing } from "./bashing";
import { blocking } from "./blocking";
import { building } from "./building";
import { climbing } from "./climbing";
import { digging } from "./digging";
import { exiting } from "./exiting";
import { falling } from "./falling";
import { jumping } from "./jumping";
import type { LemmingState, StateName } from "./LemmingState";
import { mining } from "./mining";
import { splatting } from "./splatting";
import { swimming } from "./swimming";
import { walking } from "./walking";

export type { LemmingState, StateName } from "./LemmingState";

/** Registry used for transitions, so state modules never import one another. */
export const STATES: Readonly<Record<StateName, LemmingState>> = {
  falling,
  walking,
  jumping,
  digging,
  building,
  swimming,
  exiting,
  splatting,
  climbing,
  blocking,
  bashing,
  mining,
};
