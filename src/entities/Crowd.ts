import {
  RELEASE_RATE_DEFAULT,
  RELEASE_RATE_MAX,
  RELEASE_RATE_MIN,
  RELEASE_RATE_STEP,
  SPAWN_INTERVAL,
  TILE_SIZE,
} from "../config";
import type { Level } from "../world/Level";
import { Lemming } from "./Lemming";
import type { World } from "./World";

/** Seconds between releases at a given release rate. */
export function releaseInterval(rate: number): number {
  return SPAWN_INTERVAL - (rate - RELEASE_RATE_DEFAULT) * RELEASE_RATE_STEP;
}

const clampRate = (rate: number) => Math.min(RELEASE_RATE_MAX, Math.max(RELEASE_RATE_MIN, Math.round(rate)));

/** Releases lemmings from the spawn hatch, updates them, and keeps the tally. */
export class Crowd {
  readonly lemmings: Lemming[] = [];
  released = 0;
  saved = 0;
  lost = 0;
  private rate: number;
  /**
   * Seconds since the last release. Measured up rather than counted down, so a rate change
   * applies to the release already pending. Starts full so the first lemming drops immediately.
   */
  private sinceSpawn = Infinity;

  constructor(private readonly level: Level) {
    this.rate = clampRate(level.data.releaseRate ?? RELEASE_RATE_DEFAULT);
  }

  get releaseRate(): number {
    return this.rate;
  }

  /** Change the release rate by `delta` points, clamped to the valid range. */
  adjustReleaseRate(delta: number): void {
    this.rate = clampRate(this.rate + delta);
  }

  get total(): number {
    return this.level.data.lemmingCount;
  }

  /** Lemmings currently in play. */
  get active(): number {
    return this.lemmings.length;
  }

  /** Every lemming has been released and none are still in play. */
  get finished(): boolean {
    return this.released === this.total && this.lemmings.length === 0;
  }

  update(world: World, dt: number): void {
    this.sinceSpawn += dt;
    if (this.released < this.total && this.sinceSpawn >= releaseInterval(this.rate)) {
      this.spawn();
      this.sinceSpawn = 0;
    }

    for (const l of this.lemmings) l.update(world, dt);
    this.removeFinished();
  }

  private spawn(): void {
    const { spawn } = this.level;
    const x = spawn.x * TILE_SIZE + TILE_SIZE / 2;
    const y = spawn.y * TILE_SIZE + TILE_SIZE;
    this.lemmings.push(new Lemming(x, y, this.level.data.bricks ?? 0));
    this.released++;
  }

  private removeFinished(): void {
    let w = 0;
    for (const l of this.lemmings) {
      if (!l.done) this.lemmings[w++] = l;
      else if (l.fate === "saved") this.saved++;
      else this.lost++;
    }
    this.lemmings.length = w;
  }
}
