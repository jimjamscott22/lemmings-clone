import { TILE_SIZE } from "../config";
import type { Grid } from "../world/Grid";
import { TILE_PROPS } from "../world/TileType";
import { drawAnimatedTile, drawStaticTile } from "./tileArt";

/**
 * Renders the grid efficiently:
 *  - Static tiles (dirt, wall, bridge) are baked into an offscreen canvas once and blitted each frame.
 *    When a tile changes we re-bake just that tile and its neighbours (edge details depend on them).
 *  - Animated tiles (water, goal) are tracked in a list and drawn live every frame.
 */
export class TileLayer {
  private readonly cache: HTMLCanvasElement;
  private readonly cacheCtx: CanvasRenderingContext2D;
  private animated: Array<{ x: number; y: number }> = [];
  private animatedDirty = true;
  private readonly unsubscribe: () => void;

  constructor(private readonly grid: Grid) {
    this.cache = document.createElement("canvas");
    this.cache.width = grid.cols * TILE_SIZE;
    this.cache.height = grid.rows * TILE_SIZE;
    this.cacheCtx = this.cache.getContext("2d")!;

    this.bakeAll();
    this.unsubscribe = grid.onChange((x, y) => this.onTileChanged(x, y));
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.drawImage(this.cache, 0, 0);

    if (this.animatedDirty) this.rebuildAnimatedList();
    for (const { x, y } of this.animated) drawAnimatedTile(ctx, this.grid, x, y, time);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private bakeAll(): void {
    this.cacheCtx.clearRect(0, 0, this.cache.width, this.cache.height);
    this.grid.forEach((x, y) => drawStaticTile(this.cacheCtx, this.grid, x, y));
  }

  private onTileChanged(x: number, y: number): void {
    this.animatedDirty = true;

    // Clear the 3x3 neighbourhood first, then redraw top-to-bottom, so decorations that
    // overhang tile bounds (e.g. grass blades) are restored correctly.
    const T = TILE_SIZE;
    this.cacheCtx.clearRect((x - 1) * T, (y - 1) * T, 3 * T, 3 * T);
    for (let ny = y - 1; ny <= y + 1; ny++) {
      for (let nx = x - 1; nx <= x + 1; nx++) {
        if (this.grid.inBounds(nx, ny)) drawStaticTile(this.cacheCtx, this.grid, nx, ny);
      }
    }
    // The row below the cleared area may have grass blades overhanging into it; redraw it too.
    for (let nx = x - 1; nx <= x + 1; nx++) {
      if (this.grid.inBounds(nx, y + 2)) drawStaticTile(this.cacheCtx, this.grid, nx, y + 2);
    }
  }

  private rebuildAnimatedList(): void {
    this.animated = [];
    this.grid.forEach((x, y, tile) => {
      if (TILE_PROPS[tile].animated) this.animated.push({ x, y });
    });
    this.animatedDirty = false;
  }
}
