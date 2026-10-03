import { GRAVITY, LEMMING_HEIGHT, MAX_FALL_SPEED, TILE_SIZE } from "../../config";
import { toTile } from "../World";
import type { LemmingState } from "./LemmingState";

/** Straight down under gravity until landing on a solid tile top, or dropping out of the map. */
export const falling: LemmingState = {
  name: "falling",

  enter(l) {
    l.vx = 0;
    l.vy = Math.max(l.vy, 0);
  },

  update(l, world, dt) {
    const { grid } = world;
    l.vy = Math.min(l.vy + GRAVITY * dt, MAX_FALL_SPEED);
    const ny = l.y + l.vy * dt;

    // Check every tile top crossed this step (MAX_FALL_SPEED keeps that to one, but stay general).
    for (let row = toTile(l.y) + 1; row * TILE_SIZE <= ny; row++) {
      if (grid.isSolid(l.col, row)) {
        l.y = row * TILE_SIZE;
        l.vy = 0;
        return l.setState("walking", world);
      }
    }
    l.y = ny;

    // Out the bottom of the map: lost to the void.
    if (l.y - LEMMING_HEIGHT > grid.rows * TILE_SIZE) l.retire("lost");
  },
};
