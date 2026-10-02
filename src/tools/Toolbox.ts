import type { Level, TilePoint } from "../world/Level";
import { TOOLS, type ToolId } from "./tools";

/**
 * The player's tool belt: which tool is selected, how many charges each has left, and the
 * click-and-drag stroke that applies it. A stroke edits every tile the pointer passes over,
 * filling gaps between samples so fast drags don't skip tiles.
 */
export class Toolbox {
  selected: ToolId = "dig";
  readonly charges: Record<ToolId, number>;
  private lastTile: TilePoint | null = null;

  constructor(private readonly level: Level) {
    this.charges = { dig: level.data.tools?.dig ?? 0, build: level.data.tools?.build ?? 0 };
  }

  select(id: ToolId): void {
    this.selected = id;
  }

  /** Whether the selected tool could be used on this tile right now. */
  canUseAt(tile: TilePoint): boolean {
    const tool = TOOLS[this.selected];
    return this.charges[this.selected] > 0 && tool.canApply(this.level.grid, tile.x, tile.y, this.level.spawn);
  }

  /** Continue (or start) a stroke at `tile`. Returns how many tiles were changed. */
  stroke(tile: TilePoint): number {
    const from = this.lastTile ?? tile;
    this.lastTile = tile;
    let changed = 0;
    for (const t of tilesOnLine(from, tile)) {
      if (!this.canUseAt(t)) continue;
      TOOLS[this.selected].apply(this.level.grid, t.x, t.y);
      this.charges[this.selected]--;
      changed++;
    }
    return changed;
  }

  endStroke(): void {
    this.lastTile = null;
  }
}

/** Grid cells on the line from a to b inclusive (Bresenham). */
export function tilesOnLine(a: TilePoint, b: TilePoint): TilePoint[] {
  const out: TilePoint[] = [];
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  let { x, y } = a;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
