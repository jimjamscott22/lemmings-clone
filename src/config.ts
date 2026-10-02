/** Size of one grid tile in canvas pixels (before CSS upscaling). */
export const TILE_SIZE = 16;

/** Simulation runs at a fixed rate so physics is deterministic regardless of display refresh rate. */
export const FIXED_TIMESTEP = 1 / 60;

/** Cap on real time consumed per frame; prevents a "spiral of death" after tab switches or breakpoints. */
export const MAX_FRAME_TIME = 0.25;
