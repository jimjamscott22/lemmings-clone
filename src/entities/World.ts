import { TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";

/** What a lemming state can see and change while it updates. */
export interface World {
  readonly grid: Grid;
}

/** Pixel coordinate → tile index. */
export function toTile(px: number): number {
  return Math.floor(px / TILE_SIZE);
}
