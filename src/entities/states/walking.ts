import { TileType } from "../../world/TileType";
import type { Lemming } from "../Lemming";
import type { World } from "../World";
import type { LemmingState } from "./LemmingState";
import { turnAround, walkStep } from "./movement";

/** Walk along the ground and fall off ledges. Obstacles hand off to `onBlocked`. */
export const walking: LemmingState = {
  name: "walking",

  update(l, world, dt) {
    if (!l.isGrounded(world.grid)) return l.setState("falling", world);
    const aheadCol = walkStep(l, world, dt);
    if (aheadCol !== null) onBlocked(l, world, aheadCol);
  },
};

/**
 * The walker's decision table when something solid is directly ahead, in priority order:
 *  1. A one-tile step with headroom → jump onto it.
 *  2. A climber → climb the wall.
 *  3. Dirt → dig through it.
 *  4. Anything taller, with bricks in hand → build a bridge block underfoot to climb.
 *  5. Otherwise → turn around.
 */
function onBlocked(l: Lemming, world: World, aheadCol: number): void {
  const { grid } = world;
  const row = l.bodyRow;
  const headroom = !grid.isSolid(l.col, row - 1);
  const inMap = aheadCol >= 0 && aheadCol < grid.cols;

  if (headroom && !grid.isSolid(aheadCol, row - 1) && inMap) {
    l.setState("jumping", world);
  } else if (l.climber && inMap) {
    l.setState("climbing", world);
  } else if (grid.get(aheadCol, row) === TileType.Dirt) {
    l.setState("digging", world);
  } else if (headroom && l.bricks > 0 && grid.get(l.col, row) === TileType.Empty) {
    l.setState("building", world);
  } else {
    turnAround(l);
  }
}
