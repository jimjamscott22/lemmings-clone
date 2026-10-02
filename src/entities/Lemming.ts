import { TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";
import { STATES, type LemmingState, type StateName } from "./states";
import { toTile, type World } from "./World";

/** Where a lemming ended up. "active" lemmings are still in play. */
export type Fate = "active" | "saved" | "lost";

let nextId = 1;

/**
 * A single lemming. Position is the centre-bottom of its feet, in canvas pixels.
 * All behaviour lives in the state objects (see ./states); this class only holds data
 * and drives the current state.
 */
export class Lemming {
  readonly id = nextId++;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Facing / walking direction: 1 = right, -1 = left. */
  dir: 1 | -1 = 1;

  state: LemmingState = STATES.falling;
  /** Seconds spent in the current state; drives timers and animation frames. */
  stateTime = 0;

  fate: Fate = "active";
  /** True once the exit / death animation has finished and the lemming can be removed. */
  done = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** Grid column containing the lemming's centre. */
  get col(): number {
    return toTile(this.x);
  }

  /** Grid row containing the lemming's body (the row just above its feet). */
  get bodyRow(): number {
    return toTile(this.y - 1);
  }

  /** Grid row directly under the feet. Only meaningful when standing on a tile top. */
  get groundRow(): number {
    return toTile(this.y);
  }

  /** Feet resting exactly on top of a solid tile. */
  isGrounded(grid: Grid): boolean {
    return this.y % TILE_SIZE === 0 && grid.isSolid(this.col, this.groundRow);
  }

  setState(name: StateName, world: World): void {
    this.state = STATES[name];
    this.stateTime = 0;
    this.state.enter?.(this, world);
  }

  update(world: World, dt: number): void {
    if (this.done) return;
    this.stateTime += dt;
    this.state.update(this, world, dt);
  }

  /** Mark the lemming as finished with the given fate (saved or lost). */
  retire(fate: Exclude<Fate, "active">): void {
    this.fate = fate;
    this.done = true;
  }
}
