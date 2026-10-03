import { CLIMB_SPEED, LEMMING_HEIGHT } from "../../config";
import { toTile } from "../World";
import type { LemmingState } from "./LemmingState";
import { stepOnto, turnAround } from "./movement";

/**
 * Climber skill: scale the wall face ahead. On reaching the top it hauls itself onto the ledge and
 * walks on; bumping its head on an overhang makes it let go and fall back the way it came.
 */
export const climbing: LemmingState = {
  name: "climbing",

  enter(l) {
    l.vx = 0;
    l.vy = 0;
  },

  update(l, world, dt) {
    const { grid } = world;
    const wallCol = l.frontCol;
    const feetRow = toTile(l.y - 1);

    // Feet are above the wall top (or the wall was dug away): step onto the ledge.
    if (!grid.isSolid(wallCol, feetRow)) {
      stepOnto(l, wallCol, feetRow + 1);
      return l.setState("walking", world);
    }

    const ny = l.y - CLIMB_SPEED * dt;
    if (grid.isSolid(l.col, toTile(ny - LEMMING_HEIGHT))) {
      turnAround(l);
      return l.setState(l.isGrounded(grid) ? "walking" : "falling", world);
    }
    l.y = ny;
  },
};
