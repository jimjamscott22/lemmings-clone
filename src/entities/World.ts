import { TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";
import type { Lemming } from "./Lemming";

/** Optional presentation events; headless simulations don't need a listener. */
export type SimulationEvent = "hatch" | "dig" | "splash" | "exit";

/** What a lemming state can see and change while it updates. */
export interface World {
  readonly grid: Grid;
  /** Every lemming in play (blockers need to be seen by the others). */
  readonly lemmings: readonly Lemming[];
  readonly onEvent?: (event: SimulationEvent) => void;
}

/** Pixel coordinate → tile index. */
export function toTile(px: number): number {
  return Math.floor(px / TILE_SIZE);
}
