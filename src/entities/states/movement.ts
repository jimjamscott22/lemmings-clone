import { BLOCKER_REACH, LEMMING_HALF_WIDTH, TILE_SIZE, WALK_SPEED } from "../../config";
import type { Lemming } from "../Lemming";
import { toTile, type World } from "../World";

/** Movement shared by several states. Not a state itself. */

export function turnAround(l: Lemming): void {
  l.dir = l.dir === 1 ? -1 : 1;
}

/**
 * Walk one step along the ground: turn around at blockers, and fall off ledges.
 * Returns the column of the solid tile in the way (without moving), or null.
 */
export function walkStep(l: Lemming, world: World, dt: number): number | null {
  const { grid } = world;
  const nx = l.x + l.dir * WALK_SPEED * dt;
  const aheadCol = toTile(nx + l.dir * LEMMING_HALF_WIDTH);
  if (grid.isSolid(aheadCol, l.bodyRow)) return aheadCol;
  if (blockerAhead(l, nx, world.lemmings)) {
    turnAround(l);
    return null;
  }

  l.x = nx;
  if (!l.isGrounded(grid)) l.setState("falling", world);
  return null;
}

/** A blocker in the same row that the walker is heading toward and about to bump into. */
function blockerAhead(l: Lemming, nx: number, lemmings: readonly Lemming[]): boolean {
  return lemmings.some(
    (b) =>
      b !== l &&
      b.state.name === "blocking" &&
      b.bodyRow === l.bodyRow &&
      Math.sign(b.x - l.x) === l.dir &&
      Math.abs(b.x - nx) < BLOCKER_REACH,
  );
}

/** Step up onto the top of tile (col, row), just inside the edge it is approached from. */
export function stepOnto(l: Lemming, col: number, row: number): void {
  const inset = LEMMING_HALF_WIDTH + 1;
  l.x = l.dir === 1 ? col * TILE_SIZE + inset : (col + 1) * TILE_SIZE - inset;
  l.y = row * TILE_SIZE;
}
