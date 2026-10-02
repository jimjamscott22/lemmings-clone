import { TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";
import { TileType } from "../world/TileType";
import { PALETTE } from "./palette";

const T = TILE_SIZE;

/** Cheap deterministic hash → [0, 1). Gives each tile stable "random" texture without storing anything. */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Draws a static (non-animated) tile at grid position (x, y).
 * Looks at neighbours for edge details, so callers must redraw neighbours when a tile changes.
 */
export function drawStaticTile(ctx: CanvasRenderingContext2D, grid: Grid, x: number, y: number): void {
  const px = x * T;
  const py = y * T;
  switch (grid.get(x, y)) {
    case TileType.Dirt:
      drawDirt(ctx, grid, x, y, px, py);
      break;
    case TileType.Wall:
      drawWall(ctx, px, py);
      break;
    case TileType.Bridge:
      drawBridge(ctx, px, py);
      break;
    default:
      // Empty / animated tiles leave the static layer transparent.
      break;
  }
}

function drawDirt(ctx: CanvasRenderingContext2D, grid: Grid, x: number, y: number, px: number, py: number): void {
  ctx.fillStyle = PALETTE.dirt;
  ctx.fillRect(px, py, T, T);

  // Speckles
  for (let i = 0; i < 6; i++) {
    const sx = Math.floor(hash(x, y, i) * (T - 2));
    const sy = Math.floor(hash(x, y, i + 17) * (T - 2));
    ctx.fillStyle = hash(x, y, i + 31) > 0.5 ? PALETTE.dirtDark : PALETTE.dirtLight;
    ctx.fillRect(px + sx, py + sy, 2, 2);
  }

  // Grass cap on exposed tops
  if (!grid.isSolid(x, y - 1)) {
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fillRect(px, py, T, 4);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(px, py, T, 3);
    for (let i = 0; i < 3; i++) {
      const bx = Math.floor(hash(x, y, i + 50) * (T - 1));
      ctx.fillRect(px + bx, py - 1, 1, 1); // blades poking above the tile
    }
  }
}

function drawWall(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(px, py, T, T);
  // Bevel
  ctx.fillStyle = PALETTE.wallLight;
  ctx.fillRect(px, py, T, 1);
  ctx.fillRect(px, py, 1, T);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(px, py + T - 1, T, 1);
  ctx.fillRect(px + T - 1, py, 1, T);
  // Rivets
  const r = 3;
  const far = T - r - 1;
  for (const [rx, ry] of [[r, r], [far, r], [r, far], [far, far]] as const) {
    ctx.fillStyle = PALETTE.wallDark;
    ctx.fillRect(px + rx, py + ry, 2, 2);
    ctx.fillStyle = PALETTE.wallLight;
    ctx.fillRect(px + rx, py + ry, 1, 1);
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Planks across the top half of the tile with a support truss beneath.
  ctx.fillStyle = PALETTE.bridge;
  ctx.fillRect(px, py, T, 6);
  ctx.fillStyle = PALETTE.bridgeDark;
  ctx.fillRect(px, py + 6, T, 1);
  for (let i = 3; i < T; i += 4) ctx.fillRect(px + i, py, 1, 6);
  // Diagonal brace
  for (let i = 0; i < T - 7; i++) {
    ctx.fillRect(px + i, py + 7 + i, 1, 1);
    ctx.fillRect(px + T - 1 - i, py + 7 + i, 1, 1);
  }
}

/** Water and goal tiles: drawn every frame with a time parameter (seconds). */
export function drawAnimatedTile(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  x: number,
  y: number,
  time: number,
): void {
  const tile = grid.get(x, y);
  if (tile === TileType.Water) drawWater(ctx, grid, x, y, time);
  else if (tile === TileType.Goal) drawGoal(ctx, x, y, time);
}

function drawWater(ctx: CanvasRenderingContext2D, grid: Grid, x: number, y: number, time: number): void {
  const px = x * T;
  const py = y * T;
  const surface = grid.get(x, y - 1) !== TileType.Water;

  ctx.fillStyle = surface ? PALETTE.water : PALETTE.waterDeep;
  ctx.fillRect(px, py, T, T);

  if (surface) {
    // Rolling wave crest: each column bobs on a sine based on world x.
    ctx.fillStyle = PALETTE.waterFoam;
    for (let i = 0; i < T; i++) {
      const wx = px + i;
      const h = Math.sin(wx * 0.45 + time * 4) * 1.5 + 1.5;
      ctx.fillRect(wx, py + Math.round(h), 1, 1);
    }
  }
}

function drawGoal(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const cx = x * T + T / 2;
  const cy = y * T + T / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);

  ctx.fillStyle = PALETTE.goalGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, T * (0.55 + 0.2 * pulse), 0, Math.PI * 2);
  ctx.fill();

  // Door frame with an open archway
  ctx.fillStyle = PALETTE.goal;
  ctx.fillRect(cx - 6, cy - 7, 12, 15);
  ctx.fillStyle = PALETTE.skyTop;
  ctx.fillRect(cx - 3, cy - 4, 6, 12);
  ctx.fillRect(cx - 2, cy - 5, 4, 1);
}
