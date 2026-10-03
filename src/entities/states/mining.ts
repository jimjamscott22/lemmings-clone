import { MINE_TIME, TILE_SIZE } from "../../config";
import type { Grid } from "../../world/Grid";
import { TileType } from "../../world/TileType";
import type { LemmingState } from "./LemmingState";

/**
 * Miner skill: dig a diagonal staircase down and forward. Every MINE_TIME it clears the two tiles
 * ahead (body row and the one below) and steps down into them. Gives up at anything it can't dig;
 * falls if it breaks out into open air. Later lemmings walk down the steps.
 */
export const mining: LemmingState = {
  name: "mining",

  update(l, world) {
    const { grid } = world;
    if (!l.isGrounded(grid)) return l.setState("falling", world);
    if (l.stateTime < MINE_TIME) return;

    const col = l.col + l.dir;
    const row = l.bodyRow;
    if (isHard(grid, col, row) || isHard(grid, col, row + 1)) return l.setState("walking", world);

    for (const r of [row, row + 1]) if (grid.isDiggable(col, r)) grid.set(col, r, TileType.Empty);
    l.x = col * TILE_SIZE + TILE_SIZE / 2;
    l.y += TILE_SIZE;
    l.stateTime = 0;
    if (!l.isGrounded(grid)) l.setState("falling", world);
  },
};

/** Solid but undiggable: wall, or the side edges of the map. */
function isHard(grid: Grid, col: number, row: number): boolean {
  return grid.isSolid(col, row) && !grid.isDiggable(col, row);
}
