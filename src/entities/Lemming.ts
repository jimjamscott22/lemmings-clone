import { BOMB_FUSE, LEMMING_HALF_WIDTH, TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";
import { TileType } from "../world/TileType";
import { blast } from "./blast";
import { STATES, type LemmingState, type StateName } from "./states";
import { toTile, type World } from "./World";

/** Where a lemming ended up. "active" lemmings are still in play. */
export type Fate = "active" | "saved" | "lost";

let nextId = 1;

/** How many stacked tiles a lemming can climb out of before it counts as crushed. */
const MAX_ESCAPE_TILES = 3;

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

  /** Bridge blocks this lemming can still lay. */
  bricks: number;

  /** Permanent upgrades given by the player: climbs walls / survives long falls. */
  climber = false;
  floater = false;
  /** Seconds until a bomber explodes, or null if it isn't one. */
  fuse: number | null = null;
  /** Where the current fall started, for fall damage. Set when entering the falling state (and on spawn). */
  fallStartY: number;

  constructor(x: number, y: number, bricks = 0) {
    this.x = x;
    this.y = y;
    this.fallStartY = y;
    this.bricks = bricks;
  }

  /** Grid column containing the lemming's centre. */
  get col(): number {
    return toTile(this.x);
  }

  /** Column of the tile directly in front: the one it bumps into, digs or climbs. */
  get frontCol(): number {
    return toTile(this.x + this.dir * (LEMMING_HALF_WIDTH + 1));
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
    if (name === "swimming") world.onEvent?.("splash");
    else if (name === "exiting") world.onEvent?.("exit");
  }

  update(world: World, dt: number): void {
    if (this.done) return;
    this.stateTime += dt;
    if (this.tickFuse(world, dt)) return;
    this.escapeTerrain(world);
    this.checkTriggers(world);
    this.state.update(this, world, dt);
  }

  /** Start the bomber countdown, unless one is already running or the lemming is already on its way out. */
  lightFuse(): void {
    if (this.done || this.fuse !== null) return;
    if (this.state.name === "exiting" || this.state.name === "splatting") return;
    this.fuse = BOMB_FUSE;
  }

  /** Count down a bomber's fuse; returns true if it went off. Reaching the exit defuses it. */
  private tickFuse(world: World, dt: number): boolean {
    if (this.fuse === null || this.state.name === "exiting") return false;
    this.fuse -= dt;
    if (this.fuse > 0) return false;
    blast(world.grid, this.x, this.y - TILE_SIZE / 2);
    this.retire("lost");
    return true;
  }

  /** Tiles that take over whatever the lemming was doing: the goal and water. */
  private checkTriggers(world: World): void {
    const name = this.state.name;
    if (name === "exiting") return;
    const tile = world.grid.get(this.col, this.bodyRow);
    if (tile === TileType.Goal) this.setState("exiting", world);
    else if (tile === TileType.Water && name !== "swimming") this.setState("swimming", world);
  }

  /**
   * If terrain appeared where the body is (a bridge laid on top of it — possibly several in one
   * tick when builders share a column), climb to the first open tile above, up to
   * MAX_ESCAPE_TILES. A lemming sealed in deeper than that is crushed.
   */
  private escapeTerrain(world: World): void {
    const { grid } = world;
    let row = this.bodyRow;
    if (!grid.isSolid(this.col, row)) return;
    for (let i = 0; i < MAX_ESCAPE_TILES && grid.isSolid(this.col, row); i++) row--;
    if (grid.isSolid(this.col, row)) return this.retire("lost");
    this.y = (row + 1) * TILE_SIZE;
    this.vy = 0;
    if (this.state.name === "falling" || this.state.name === "jumping") this.setState("walking", world);
  }

  /** Mark the lemming as finished with the given fate (saved or lost). */
  retire(fate: Exclude<Fate, "active">): void {
    this.fate = fate;
    this.done = true;
  }
}
