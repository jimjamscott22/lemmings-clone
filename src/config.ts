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

/** Seconds between lemmings dropping out of the hatch. */
export const SPAWN_INTERVAL = 1.5;
