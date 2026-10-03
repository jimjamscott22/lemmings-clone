import { FIXED_TIMESTEP, TILE_SIZE } from "../config";
import { Lemming } from "../entities/Lemming";
import type { World } from "../entities/World";
import { parseLevel } from "../world/Level";

/** A test world whose lemming list can be added to. */
export interface TestWorld extends World {
  readonly lemmings: Lemming[];
}

/**
 * Test harness: builds a world from an ASCII map (same legend as levels.ts) and places a
 * lemming standing on the floor of the spawn tile 'S'.
 */
export function setup(map: string[]): { world: TestWorld; lemming: Lemming } {
  const level = parseLevel({ name: "test", map, lemmingCount: 1, requiredToSave: 1 });
  const world: TestWorld = { grid: level.grid, lemmings: [] };
  const lemming = place(world, level.spawn.x, level.spawn.y);
  return { world, lemming };
}

/** Add another lemming standing in tile (col, row), walking in direction `dir`. */
export function place(world: TestWorld, col: number, row: number, dir: 1 | -1 = 1): Lemming {
  const l = new Lemming(col * TILE_SIZE + TILE_SIZE / 2, (row + 1) * TILE_SIZE);
  l.dir = dir;
  world.lemmings.push(l);
  return l;
}

/** Run fixed steps until `until` is true or `seconds` of simulated time have passed. */
export function run(world: World, lemming: Lemming, seconds: number, until?: () => boolean): void {
  const steps = Math.round(seconds / FIXED_TIMESTEP);
  for (let i = 0; i < steps && !lemming.done; i++) {
    lemming.update(world, FIXED_TIMESTEP);
    if (until?.()) return;
  }
}

/** Like `run`, but updates every lemming in the world. */
export function runAll(world: World, seconds: number, until?: () => boolean): void {
  const steps = Math.round(seconds / FIXED_TIMESTEP);
  for (let i = 0; i < steps; i++) {
    for (const l of world.lemmings) l.update(world, FIXED_TIMESTEP);
    if (until?.()) return;
  }
}

export const tileX = (px: number) => Math.floor(px / TILE_SIZE);
