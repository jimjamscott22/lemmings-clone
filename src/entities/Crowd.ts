import { SPAWN_INTERVAL, TILE_SIZE } from "../config";
import type { Level } from "../world/Level";
import { Lemming } from "./Lemming";
import type { World } from "./World";

/** Releases lemmings from the spawn hatch, updates them, and keeps the tally. */
export class Crowd {
  readonly lemmings: Lemming[] = [];
  released = 0;
  saved = 0;
  lost = 0;
  /** Counts down to the next release; the first lemming drops immediately. */
  private spawnTimer = 0;

  constructor(private readonly level: Level) {}

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
    this.spawnTimer -= dt;
    if (this.released < this.total && this.spawnTimer <= 0) {
      this.spawn();
      this.spawnTimer = SPAWN_INTERVAL;
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
