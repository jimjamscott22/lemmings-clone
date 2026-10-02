import { DIG_TIME, LEMMING_HALF_WIDTH } from "../../config";
import { TileType } from "../../world/TileType";
import type { Lemming } from "../Lemming";
import { toTile } from "../World";
import type { LemmingState } from "./LemmingState";

/** Tunnel horizontally: chip away at the dirt tile ahead for DIG_TIME, then remove it and walk on. */
export const digging: LemmingState = {
  name: "digging",

  update(l, world) {
    const { grid } = world;
    if (!l.isGrounded(grid)) return l.setState("falling", world);

    const col = digTargetCol(l);
    // Someone else (or the player) cleared it first.
    if (grid.get(col, l.bodyRow) !== TileType.Dirt) return l.setState("walking", world);

    if (l.stateTime >= DIG_TIME) {
      grid.set(col, l.bodyRow, TileType.Empty);
      l.setState("walking", world);
    }
  },
};

/** Column of the tile the lemming is pressed up against. */
export function digTargetCol(l: Lemming): number {
  return toTile(l.x + l.dir * (LEMMING_HALF_WIDTH + 1));
}
