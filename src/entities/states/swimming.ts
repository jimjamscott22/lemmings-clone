import { DROWN_TIME, FLOAT_DEPTH, LEMMING_HALF_WIDTH, SWIM_ENDURANCE, SWIM_SPEED, TILE_SIZE } from "../../config";
import type { Grid } from "../../world/Grid";
import { TileType } from "../../world/TileType";
import type { Lemming } from "../Lemming";
import { toTile } from "../World";
import type { LemmingState } from "./LemmingState";
import { stepOnto } from "./movement";

/**
 * In the water: bob up to the surface and paddle forward. A swimmer that reaches a low bank
 * within SWIM_ENDURANCE climbs out; otherwise it tires, sinks for DROWN_TIME and is lost.
 */
export const swimming: LemmingState = {
  name: "swimming",

  enter(l) {
    l.vx = 0;
    l.vy = 0;
  },

  update(l, world, dt) {
    const { grid } = world;

    if (isDrowning(l)) {
      l.y += (TILE_SIZE / DROWN_TIME) * dt * 0.5;
      if (l.stateTime >= SWIM_ENDURANCE + DROWN_TIME) l.retire("lost");
      return;
    }

    // Ease up (or down, after a high dive) to floating depth below the surface.
    const surface = surfaceRow(grid, l.col, l.bodyRow);
    const floatY = surface * TILE_SIZE + FLOAT_DEPTH;
    l.y += (floatY - l.y) * Math.min(1, dt * 8);

    const nx = l.x + l.dir * SWIM_SPEED * dt;
    const aheadCol = toTile(nx + l.dir * LEMMING_HALF_WIDTH);
    if (grid.isSolid(aheadCol, surface)) {
      if (!grid.isSolid(aheadCol, surface - 1) && aheadCol >= 0 && aheadCol < grid.cols) {
        stepOnto(l, aheadCol, surface);
        return l.setState("walking", world);
      }
      l.dir = l.dir === 1 ? -1 : 1; // sheer bank: try the other way
      return;
    }
    l.x = nx;

    // Paddled out of the water entirely (e.g. off the end of a pool into open air).
    if (grid.get(l.col, toTile(l.y - 1)) !== TileType.Water) l.setState("falling", world);
  },
};

/** Out of energy: sinking. Exposed for the renderer. */
export function isDrowning(l: Lemming): boolean {
  return l.stateTime >= SWIM_ENDURANCE;
}

/** Topmost water row of the pool column containing (col, row). */
function surfaceRow(grid: Grid, col: number, row: number): number {
  let r = row;
  while (grid.get(col, r - 1) === TileType.Water) r--;
  return r;
}

