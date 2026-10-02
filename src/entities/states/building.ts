import { BUILD_TIME, TILE_SIZE } from "../../config";
import { TileType } from "../../world/TileType";
import type { LemmingState } from "./LemmingState";

/**
 * Climb a tall obstacle by laying a bridge block underfoot: after BUILD_TIME the tile the
 * lemming stands in becomes Bridge and the lemming steps up onto it. Walking then re-evaluates,
 * so a lemming keeps stacking (one brick each) until the obstacle is a one-tile jump.
 * Stacks left behind become stairs for the lemmings that follow.
 */
export const building: LemmingState = {
  name: "building",

  update(l, world) {
    const { grid } = world;
    if (!l.isGrounded(grid)) return l.setState("falling", world);
    if (l.stateTime < BUILD_TIME) return;

    const row = l.bodyRow;
    if (l.bricks > 0 && grid.get(l.col, row) === TileType.Empty && !grid.isSolid(l.col, row - 1)) {
      grid.set(l.col, row, TileType.Bridge);
      l.bricks--;
      l.y -= TILE_SIZE;
    }
    l.setState("walking", world);
  },
};
