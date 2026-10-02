import { GRAVITY, JUMP_FORWARD_SPEED, JUMP_SPEED, LEMMING_HALF_WIDTH, LEMMING_HEIGHT, MAX_FALL_SPEED, TILE_SIZE } from "../../config";
import { toTile } from "../World";
import type { LemmingState } from "./LemmingState";

/** Ballistic hop: up and forward under gravity, stopped by walls and ceilings, landing on tile tops. */
export const jumping: LemmingState = {
  name: "jumping",

  enter(l) {
    l.vy = -JUMP_SPEED;
    l.vx = l.dir * JUMP_FORWARD_SPEED;
  },

  update(l, world, dt) {
    const { grid } = world;
    l.vy = Math.min(l.vy + GRAVITY * dt, MAX_FALL_SPEED);

    // Horizontal: held back (but keeps its momentum) while any row the body spans is solid ahead.
    const nx = l.x + l.vx * dt;
    const aheadCol = toTile(nx + l.dir * LEMMING_HALF_WIDTH);
    const blocked = grid.isSolid(aheadCol, toTile(l.y - 1)) || grid.isSolid(aheadCol, toTile(l.y - LEMMING_HEIGHT));
    if (!blocked) l.x = nx;

    const ny = l.y + l.vy * dt;
    if (l.vy < 0) {
      // Rising: bump the head on ceilings.
      if (grid.isSolid(l.col, toTile(ny - LEMMING_HEIGHT))) l.vy = 0;
      else l.y = ny;
      return;
    }

    // Descending: land on the first solid tile top crossed.
    for (let row = toTile(l.y) + 1; row * TILE_SIZE <= ny; row++) {
      if (grid.isSolid(l.col, row)) {
        l.y = row * TILE_SIZE;
        l.vy = 0;
        l.vx = 0;
        return l.setState("walking", world);
      }
    }
    l.y = ny;
    if (l.y % TILE_SIZE === 0 && grid.isSolid(l.col, toTile(l.y))) return l.setState("walking", world);
    // Past the apex and still airborne for a while → hand over to a plain fall.
    if (l.vy > JUMP_SPEED / 2) l.setState("falling", world);
  },
};
