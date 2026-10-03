import { EXIT_TIME } from "../../config";
import type { LemmingState } from "./LemmingState";

/** Reached the goal: play the exit animation (see lemmingArt), then count as saved. */
export const exiting: LemmingState = {
  name: "exiting",

  enter(l) {
    l.vx = 0;
    l.vy = 0;
  },

  update(l) {
    if (l.stateTime >= EXIT_TIME) l.retire("saved");
  },
};
