import {
  LEMMING_HALF_WIDTH,
  LEMMING_HEIGHT,
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

/** Extra pixels around a lemming's body that still count as clicking it. */
const PICK_SLACK = 2;

const clampRate = (rate: number) => Math.min(RELEASE_RATE_MAX, Math.max(RELEASE_RATE_MIN, Math.round(rate)));

/** Releases lemmings from the spawn hatch, updates them, and keeps the tally. */
export class Crowd {
  readonly lemmings: Lemming[] = [];
  released = 0;
  saved = 0;
  lost = 0;
  /** The player has pulled the plug: nobody else is released and everyone in play is about to explode. */
  nuked = false;
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

  /**
   * End a hopeless run, as in the original: lemmings still in the hatch never come out (they count as
   * lost) and everyone in play gets a bomber fuse. Anyone who reaches the exit before it burns down is
   * still saved. Does nothing a second time.
   */
  nuke(): void {
    if (this.nuked) return;
    this.nuked = true;
    this.lost += this.total - this.released;
    this.released = this.total;
    for (const l of this.lemmings) l.lightFuse();
  }

  update(world: World, dt: number): void {
    this.sinceSpawn += dt;
    if (this.released < this.total && this.sinceSpawn >= releaseInterval(this.rate)) {
      this.spawn();
      if (this.released === 1) world.onEvent?.("hatch");
      this.sinceSpawn = 0;
    }

    for (const l of this.lemmings) l.update(world, dt);
    this.retireStrandedBlockers();
    this.removeFinished();
  }

  /**
   * The lemming under a canvas-pixel point, or null. Overlapping lemmings are common, so among
   * those hit it prefers ones `prefer` accepts (e.g. that can take the selected skill), then the
   * one whose body centre is nearest.
   */
  lemmingAt(p: { x: number; y: number }, prefer: (l: Lemming) => boolean = () => true): Lemming | null {
    let best: Lemming | null = null;
    let bestScore = Infinity;
    for (const l of this.lemmings) {
      if (l.done) continue;
      const dx = Math.abs(p.x - l.x);
      const dy = Math.abs(p.y - (l.y - LEMMING_HEIGHT / 2));
      if (dx > LEMMING_HALF_WIDTH + PICK_SLACK || dy > LEMMING_HEIGHT / 2 + PICK_SLACK) continue;
      const score = Math.hypot(dx, dy) + (prefer(l) ? 0 : 1000);
      if (score < bestScore) {
        best = l;
        bestScore = score;
      }
    }
    return best;
  }

  /** Once everyone is out and only blockers remain, nothing can change: count them as lost. */
  private retireStrandedBlockers(): void {
    if (this.released < this.total || this.lemmings.length === 0) return;
    if (!this.lemmings.every((l) => l.done || l.state.name === "blocking")) return;
    for (const l of this.lemmings) {
      if (!l.done && l.fuse === null) l.retire("lost");
    }
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
