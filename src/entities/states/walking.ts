import { LEMMING_HALF_WIDTH, WALK_SPEED } from "../../config";
import { TileType } from "../../world/TileType";
import type { Lemming } from "../Lemming";
import { toTile, type World } from "../World";
import type { LemmingState } from "./LemmingState";

/** Walk along the ground and fall off ledges. Obstacles hand off to `onBlocked`. */
export const walking: LemmingState = {
  name: "walking",

  update(l, world, dt) {
    const { grid } = world;
    if (!l.isGrounded(grid)) return l.setState("falling", world);

    const nx = l.x + l.dir * WALK_SPEED * dt;
    const aheadCol = toTile(nx + l.dir * LEMMING_HALF_WIDTH);
    if (grid.isSolid(aheadCol, l.bodyRow)) return onBlocked(l, world, aheadCol);

    l.x = nx;
    if (!l.isGrounded(grid)) l.setState("falling", world);
  },
};

/**
 * The walker's decision table when something solid is directly ahead, in priority order:
 *  1. A one-tile step with headroom → jump onto it.
 *  2. Dirt → dig through it.
 *  3. Anything taller, with bricks in hand → build a bridge block underfoot to climb.
 *  4. Otherwise → turn around.
 */
function onBlocked(l: Lemming, world: World, aheadCol: number): void {
  const { grid } = world;
  const row = l.bodyRow;
  const headroom = !grid.isSolid(l.col, row - 1);

  if (headroom && !grid.isSolid(aheadCol, row - 1) && aheadCol >= 0 && aheadCol < grid.cols) {
    l.setState("jumping", world);
  } else if (grid.get(aheadCol, row) === TileType.Dirt) {
    l.setState("digging", world);
  } else if (headroom && l.bricks > 0 && grid.get(l.col, row) === TileType.Empty) {
    l.setState("building", world);
  } else {
    l.dir = l.dir === 1 ? -1 : 1;
  }
}
