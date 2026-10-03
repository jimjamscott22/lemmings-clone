import { FIXED_TIMESTEP, TILE_SIZE } from "../config";
import { Lemming } from "../entities/Lemming";
import type { World } from "../entities/World";
import { parseLevel } from "../world/Level";

/**
 * Test harness: builds a world from an ASCII map (same legend as levels.ts) and places a
 * lemming standing on the floor of the spawn tile 'S'.
 */
export function setup(map: string[]): { world: World; lemming: Lemming } {
  const level = parseLevel({ name: "test", map, lemmingCount: 1, requiredToSave: 1 });
  const world: World = { grid: level.grid };
  const lemming = new Lemming(level.spawn.x * TILE_SIZE + TILE_SIZE / 2, (level.spawn.y + 1) * TILE_SIZE);
  return { world, lemming };
}

/** Run fixed steps until `until` is true or `seconds` of simulated time have passed. */
export function run(world: World, lemming: Lemming, seconds: number, until?: () => boolean): void {
  const steps = Math.round(seconds / FIXED_TIMESTEP);
  for (let i = 0; i < steps && !lemming.done; i++) {
    lemming.update(world, FIXED_TIMESTEP);
    if (until?.()) return;
  }
}

export const tileX = (px: number) => Math.floor(px / TILE_SIZE);
