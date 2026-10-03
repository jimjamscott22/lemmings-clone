import { TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";
import type { Lemming } from "./Lemming";

/** What a lemming state can see and change while it updates. */
export interface World {
  readonly grid: Grid;
  /** Every lemming in play (blockers need to be seen by the others). */
  readonly lemmings: readonly Lemming[];
}

/** Pixel coordinate → tile index. */
export function toTile(px: number): number {
  return Math.floor(px / TILE_SIZE);
}
