/** Size of one grid tile in canvas pixels (before CSS upscaling). */
export const TILE_SIZE = 16;

/** Simulation runs at a fixed rate so physics is deterministic regardless of display refresh rate. */
export const FIXED_TIMESTEP = 1 / 60;

/** Cap on real time consumed per frame; prevents a "spiral of death" after tab switches or breakpoints. */
export const MAX_FRAME_TIME = 0.25;

/* Lemming physics — canvas pixels and seconds. */

/** Downward acceleration while falling or jumping. */
export const GRAVITY = 720;
/** Terminal velocity; keeps fast falls from tunnelling through a tile in one step. */
export const MAX_FALL_SPEED = 180;
export const WALK_SPEED = 20;

/** Lemming body size. Smaller than one tile, so a walking lemming occupies a single tile row. */
export const LEMMING_HEIGHT = 10;
export const LEMMING_HALF_WIDTH = 3;

/** Seconds between lemmings dropping out of the hatch at the default release rate. */
export const SPAWN_INTERVAL = 1.5;

/** Release rate, as in the original: 1 (slowest) to 99 (fastest). Adjustable with +/- during play. */
export const RELEASE_RATE_MIN = 1;
export const RELEASE_RATE_MAX = 99;
export const RELEASE_RATE_DEFAULT = 50;
/** Seconds of spawn interval removed per rate point above the default (added per point below). */
export const RELEASE_RATE_STEP = 0.025;
/** Rate points per second while +/- is held down. */
export const RELEASE_RATE_HOLD_SPEED = 20;

/** Launch speeds for a jump. Tuned so the arc clears exactly one tile and lands on top of it. */
export const JUMP_SPEED = 185;
export const JUMP_FORWARD_SPEED = 40;

/** Seconds to dig through one dirt tile. */
export const DIG_TIME = 0.8;
/** Seconds to lay one bridge block. */
export const BUILD_TIME = 0.6;

/* Hazards and the exit. */

/** Paddling speed at the water's surface. */
export const SWIM_SPEED = 10;
/** Seconds a lemming can stay afloat before it starts to sink. */
export const SWIM_ENDURANCE = 2.5;
/** Seconds of sinking before a drowning lemming is gone. */
export const DROWN_TIME = 0.8;
/** How far below the surface a swimmer's feet hang (head stays above water). */
export const FLOAT_DEPTH = 7;
/** Seconds for the walk-into-the-door animation. */
export const EXIT_TIME = 0.5;

/** Falls longer than this (pixels) are fatal, unless the lemming is a floater. */
export const SPLAT_HEIGHT = 9 * TILE_SIZE;
/** Seconds of the splat animation before the lemming is gone. */
export const SPLAT_TIME = 0.6;

/* Skills given to individual lemmings. */

/** Climbing speed up a wall face. */
export const CLIMB_SPEED = 14;
/** A floater opens its umbrella after falling this far, then drifts down at FLOAT_SPEED. */
export const FLOATER_OPEN_HEIGHT = TILE_SIZE;
export const FLOAT_SPEED = 40;
/** Seconds from giving the Bomber skill to the explosion. A nuke lights this fuse on everyone. */
export const BOMB_FUSE = 5;
/** Seconds the Nuke button stays armed after the first press, waiting for the confirming press. */
export const NUKE_CONFIRM_TIME = 3;
/** Diggable tiles whose centre is within this many pixels of the bomber are blown away. */
export const BOMB_RADIUS = 1.5 * TILE_SIZE;
/** A walker heading toward a blocker turns around once their centres are this close. */
export const BLOCKER_REACH = 6;
/** Seconds to bash through one tile. */
export const BASH_TIME = 0.4;
/** Seconds to mine one diagonal step. */
export const MINE_TIME = 0.9;
