import { TILE_PROPS, TileType } from "./TileType";

export type TileChangeListener = (x: number, y: number, tile: TileType) => void;

/**
 * The 2D tile map. Stored as a flat row-major Uint8Array.
 *
 * Out-of-bounds convention:
 *  - `get` returns Empty everywhere outside the map (the "void").
 *  - `isSolid` treats the left/right edges as solid so entities can't walk off the sides,
 *    but the top and bottom stay open — falling out the bottom is a death condition.
 */
export class Grid {
  private readonly tiles: Uint8Array;
  private readonly listeners = new Set<TileChangeListener>();

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.tiles = new Uint8Array(cols * rows);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  get(x: number, y: number): TileType {
    if (!this.inBounds(x, y)) return TileType.Empty;
    return this.tiles[y * this.cols + x] as TileType;
  }

  /** Sets a tile and notifies listeners. No-op (and no event) if out of bounds or unchanged. */
  set(x: number, y: number, tile: TileType): void {
    if (!this.inBounds(x, y)) return;
    const i = y * this.cols + x;
    if (this.tiles[i] === tile) return;
    this.tiles[i] = tile;
    for (const listener of this.listeners) listener(x, y, tile);
  }

  isSolid(x: number, y: number): boolean {
    if (x < 0 || x >= this.cols) return true;
    return TILE_PROPS[this.get(x, y)].solid;
  }

  /** Subscribe to tile changes. Returns an unsubscribe function. */
  onChange(listener: TileChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  forEach(fn: (x: number, y: number, tile: TileType) => void): void {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        fn(x, y, this.tiles[y * this.cols + x] as TileType);
      }
    }
  }
}
