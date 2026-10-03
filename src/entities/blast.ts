import { BOMB_RADIUS, TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";
import { TILE_PROPS, TileType } from "../world/TileType";
import { toTile } from "./World";

/** A bomber goes off at (x, y): every diggable tile whose centre is within BOMB_RADIUS is cleared. */
export function blast(grid: Grid, x: number, y: number): void {
  const r2 = BOMB_RADIUS * BOMB_RADIUS;
  for (let row = toTile(y - BOMB_RADIUS); row <= toTile(y + BOMB_RADIUS); row++) {
    for (let col = toTile(x - BOMB_RADIUS); col <= toTile(x + BOMB_RADIUS); col++) {
      const dx = (col + 0.5) * TILE_SIZE - x;
      const dy = (row + 0.5) * TILE_SIZE - y;
      if (dx * dx + dy * dy <= r2 && TILE_PROPS[grid.get(col, row)].diggable) grid.set(col, row, TileType.Empty);
    }
  }
}
