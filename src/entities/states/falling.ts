import { FLOAT_SPEED, FLOATER_OPEN_HEIGHT, GRAVITY, LEMMING_HEIGHT, MAX_FALL_SPEED, SPLAT_HEIGHT, TILE_SIZE } from "../../config";
import type { Lemming } from "../Lemming";
import { toTile } from "../World";
import type { LemmingState } from "./LemmingState";

/**
 * Straight down under gravity until landing on a solid tile top, or dropping out of the map.
 * Landing after a fall longer than SPLAT_HEIGHT is fatal, unless the lemming is a floater.
 */
export const falling: LemmingState = {
  name: "falling",

  enter(l) {
    l.vx = 0;
    l.vy = Math.max(l.vy, 0);
    l.fallStartY = l.y;
  },

  update(l, world, dt) {
    const { grid } = world;
    l.vy = Math.min(l.vy + GRAVITY * dt, isFloating(l) ? FLOAT_SPEED : MAX_FALL_SPEED);
    const ny = l.y + l.vy * dt;

    // Check every tile top crossed this step (MAX_FALL_SPEED keeps that to one, but stay general).
    for (let row = toTile(l.y) + 1; row * TILE_SIZE <= ny; row++) {
      if (grid.isSolid(l.col, row)) {
        l.y = row * TILE_SIZE;
        l.vy = 0;
        const splat = !l.floater && l.y - l.fallStartY > SPLAT_HEIGHT;
        return l.setState(splat ? "splatting" : "walking", world);
      }
    }
    l.y = ny;

    // Out the bottom of the map: lost to the void.
    if (l.y - LEMMING_HEIGHT > grid.rows * TILE_SIZE) l.retire("lost");
  },
};

/** A floater's umbrella is open. Exposed for the renderer. */
export function isFloating(l: Lemming): boolean {
  return l.floater && l.y - l.fallStartY > FLOATER_OPEN_HEIGHT;
}
