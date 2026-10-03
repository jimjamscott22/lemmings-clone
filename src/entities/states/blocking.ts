import type { LemmingState } from "./LemmingState";

/**
 * Blocker skill: stand still with arms out for good. Walkers turn around on reaching it (see
 * movement.ts). Only falls if the ground under it is removed.
 */
export const blocking: LemmingState = {
  name: "blocking",

  enter(l) {
    l.vx = 0;
  },

  update(l, world) {
    if (!l.isGrounded(world.grid)) l.setState("falling", world);
  },
};
