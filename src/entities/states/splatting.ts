import { SPLAT_TIME } from "../../config";
import type { LemmingState } from "./LemmingState";

/** Landed from too high (see falling.ts): play the splat, then the lemming is lost. */
export const splatting: LemmingState = {
  name: "splatting",

  enter(l) {
    l.vx = 0;
    l.vy = 0;
  },

  update(l) {
    if (l.stateTime >= SPLAT_TIME) l.retire("lost");
  },
};
