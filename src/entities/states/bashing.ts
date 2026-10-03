import { BASH_TIME } from "../../config";
import { TileType } from "../../world/TileType";
import type { LemmingState } from "./LemmingState";
import { walkStep } from "./movement";

/**
 * Basher skill: walk on until terrain is in reach, then tunnel horizontally through every diggable
 * tile (dirt and bridge, including one-tile steps a walker would jump), one per BASH_TIME.
 * Stops when the tunnel breaks through into open space, or when it meets something it can't dig.
 */
export const bashing: LemmingState = {
  name: "bashing",

  update(l, world, dt) {
    const { grid } = world;
    if (!l.isGrounded(grid)) return l.setState("falling", world);

    const col = l.frontCol;
    const row = l.bodyRow;
    if (!grid.isSolid(col, row)) {
      l.stateTime = 0;
      walkStep(l, world, dt);
      return;
    }
    if (!grid.isDiggable(col, row)) return l.setState("walking", world);
    if (l.stateTime < BASH_TIME) return;

    grid.set(col, row, TileType.Empty);
    l.stateTime = 0;
    if (!grid.isDiggable(col + l.dir, row)) l.setState("walking", world);
  },
};
