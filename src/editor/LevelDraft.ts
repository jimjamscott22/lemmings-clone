import { RELEASE_RATE_DEFAULT, RELEASE_RATE_MAX, RELEASE_RATE_MIN } from "../config";
import { ACTION_ORDER, actionInfo, isSkill, type ActionId } from "../tools/actions";
import { tilesOnLine } from "../tools/Toolbox";
import { Grid } from "../world/Grid";
import { parseMap, SPAWN_CHAR, TILE_CHARS, type LevelData, type TilePoint } from "../world/Level";
import { TILE_PROPS, TileType } from "../world/TileType";

/** What the pencil and fill tools paint: a tile type, or the spawn hatch. */
export type Brush = TileType | "spawn";

/** Every brush, in palette order: each tile type as declared in `TileType`, then the hatch. */
export const BRUSHES: readonly Brush[] = [...Object.values(TileType), "spawn"];

export function brushName(brush: Brush): string {
  return brush === "spawn" ? "Hatch" : TILE_PROPS[brush].name;
}

/** A numeric LevelData parameter the editor exposes: level settings, then tool and skill charges. */
export type FieldId = "lemmingCount" | "requiredToSave" | "releaseRate" | "bricks" | ActionId;

export interface DraftField {
  id: FieldId;
  label: string;
  hint: string;
  min: number;
  max: number;
}

export const GRID_LIMITS = { minCols: 8, maxCols: 64, minRows: 6, maxRows: 40 } as const;
export const BLANK_SIZE = { cols: 48, rows: 28 } as const;

const MAX_COUNT = 99;

export const DRAFT_FIELDS: readonly DraftField[] = [
  { id: "lemmingCount", label: "Lemmings", hint: "Total released from the hatch", min: 1, max: MAX_COUNT },
  { id: "requiredToSave", label: "Save", hint: "Lemmings that must reach the goal to win", min: 1, max: MAX_COUNT },
  { id: "releaseRate", label: "Rate", hint: "Starting release rate", min: RELEASE_RATE_MIN, max: RELEASE_RATE_MAX },
  { id: "bricks", label: "Bricks", hint: "Bridge blocks each lemming carries", min: 0, max: MAX_COUNT },
  ...ACTION_ORDER.map((id): DraftField => {
    const { name } = actionInfo(id);
    return {
      id,
      label: name,
      hint: `${isSkill(id) ? "Skill" : "Tool"} charges the player gets`,
      min: 0,
      max: MAX_COUNT,
    };
  }),
];

const FIELD_BY_ID = new Map(DRAFT_FIELDS.map((f) => [f.id, f]));

const DEFAULT_NUMBERS = (): Record<FieldId, number> => ({
  lemmingCount: 10,
  requiredToSave: 5,
  releaseRate: RELEASE_RATE_DEFAULT,
  bricks: 0,
  ...(Object.fromEntries(ACTION_ORDER.map((id) => [id, 0])) as Record<ActionId, number>),
});

const EMPTY_CHAR = TILE_CHARS[TileType.Empty];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The level being edited: a tile grid, the spawn hatch, and the level's numeric parameters.
 * DOM-free like the rest of the simulation, so every edit is unit-tested headless.
 *
 * The grid is a real `Grid`, so the renderer's tile layer redraws edits through `grid.onChange`
 * exactly as it does during play. Resizing (and undo across a resize) swaps in a new grid:
 * callers compare `draft.grid` with the one they last showed.
 *
 * The spawn lives beside the grid rather than in it. Its tile is always Empty, and painting any
 * tile over the hatch removes it.
 */
export class LevelDraft {
  grid: Grid;
  spawn: TilePoint | null;
  name: string;
  private readonly numbers = DEFAULT_NUMBERS();

  /** Earlier maps (with `S`), most recent last. Only the map is undoable, not the parameters. */
  private undoStack: string[][] = [];
  private redoStack: string[][] = [];
  private strokeBase: string[] | null = null;
  private lastTile: TilePoint | null = null;

  constructor(data?: LevelData) {
    this.name = "My level";
    this.grid = new Grid(BLANK_SIZE.cols, BLANK_SIZE.rows);
    this.spawn = null;
    if (data) this.applyData(data);
  }

  /* Parameters */

  getNumber(id: FieldId): number {
    return this.numbers[id];
  }

  /** Set a parameter, rounded and clamped to its range. */
  setNumber(id: FieldId, value: number): void {
    const field = FIELD_BY_ID.get(id)!;
    if (!Number.isFinite(value)) return;
    this.numbers[id] = clamp(Math.round(value), field.min, field.max);
  }

  /* Painting */

  /** Paint one tile. Returns whether anything changed. */
  paint(tile: TilePoint, brush: Brush): boolean {
    const { x, y } = tile;
    if (!this.grid.inBounds(x, y)) return false;
    const onSpawn = this.spawn?.x === x && this.spawn.y === y;
    if (brush === "spawn") {
      if (onSpawn) return false;
      this.grid.set(x, y, TileType.Empty);
      this.spawn = { x, y };
      return true;
    }
    if (onSpawn) this.spawn = null;
    const before = this.grid.get(x, y);
    this.grid.set(x, y, brush);
    return onSpawn || before !== brush;
  }

  /**
   * Continue (or start) a drag stroke, filling the gap since the last sample with Bresenham so a
   * fast drag leaves no holes. The stroke is one undo step; end it with `endStroke`.
   */
  stroke(tile: TilePoint, brush: Brush): void {
    this.strokeBase ??= this.snapshot();
    if (brush === "spawn") {
      // The hatch is placed, not dragged: it jumps to wherever the pointer is.
      this.paint(tile, brush);
      this.lastTile = tile;
      return;
    }
    const from = this.lastTile ?? tile;
    this.lastTile = tile;
    for (const t of tilesOnLine(from, tile)) this.paint(t, brush);
  }

  endStroke(): void {
    this.lastTile = null;
    const base = this.strokeBase;
    this.strokeBase = null;
    if (base && base.join("\n") !== this.snapshot().join("\n")) this.record(base);
  }

  /** Flood-fill the 4-connected region of identical tiles around `tile`. Spawn just moves the hatch. */
  fill(tile: TilePoint, brush: Brush): boolean {
    const { grid } = this;
    if (!grid.inBounds(tile.x, tile.y)) return false;
    const base = this.snapshot();
    let changed: boolean;
    if (brush === "spawn") {
      changed = this.paint(tile, brush);
    } else {
      const target = grid.get(tile.x, tile.y);
      changed = target !== brush;
      if (changed) {
        const queue = [tile];
        const seen = new Set([tile.y * grid.cols + tile.x]);
        for (let next = queue.pop(); next; next = queue.pop()) {
          this.paint(next, brush);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const n = { x: next.x + dx, y: next.y + dy };
            const key = n.y * grid.cols + n.x;
            if (!grid.inBounds(n.x, n.y) || seen.has(key) || grid.get(n.x, n.y) !== target) continue;
            seen.add(key);
            queue.push(n);
          }
        }
      }
    }
    if (changed) this.record(base);
    return changed;
  }

  /** Empty the whole map (and remove the hatch). */
  clear(): void {
    this.record(this.snapshot());
    this.loadRows(Array.from({ length: this.grid.rows }, () => EMPTY_CHAR.repeat(this.grid.cols)));
  }

  /** Change the map size, keeping the top-left corner; new tiles are empty and cropped ones are lost. */
  resize(cols: number, rows: number): void {
    cols = clamp(Math.round(cols), GRID_LIMITS.minCols, GRID_LIMITS.maxCols);
    rows = clamp(Math.round(rows), GRID_LIMITS.minRows, GRID_LIMITS.maxRows);
    if (cols === this.grid.cols && rows === this.grid.rows) return;
    const old = this.snapshot();
    this.record(old);
    this.loadRows(
      Array.from({ length: rows }, (_, y) => (old[y] ?? "").slice(0, cols).padEnd(cols, EMPTY_CHAR)),
    );
  }

  /* History */

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    this.endStroke(); // keyboard undo mid-drag: settle the stroke first
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(this.snapshot());
    this.loadRows(previous);
    return true;
  }

  redo(): boolean {
    this.endStroke();
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.snapshot());
    this.loadRows(next);
    return true;
  }

  /* Whole-level operations */

  /** Replace the map and every parameter with `data`'s. The map change can be undone. Throws on a bad map. */
  replaceWith(data: LevelData): void {
    const base = this.snapshot();
    this.applyData(data);
    this.record(base);
  }

  /** Check for problems that stop the level from being played. Empty when it is ready to playtest. */
  problems(): string[] {
    const out: string[] = [];
    if (!this.name.trim()) out.push("Give the level a name.");
    if (!this.spawn) out.push("Place the spawn hatch.");
    let goals = 0;
    this.grid.forEach((_x, _y, tile) => {
      if (tile === TileType.Goal) goals++;
    });
    if (goals === 0) out.push("Add a goal.");
    const { requiredToSave, lemmingCount } = this.numbers;
    if (requiredToSave > lemmingCount) out.push(`Save target (${requiredToSave}) is more than the lemmings (${lemmingCount}).`);
    return out;
  }

  /** Things that don't block play but matter when the level is added to the game. */
  warnings(takenNames: readonly string[]): string[] {
    const name = this.name.trim();
    return takenNames.includes(name) ? [`A built-in level is already called “${name}”; saved progress is keyed by name.`] : [];
  }

  /** The level as `LevelData`. Without a spawn the map simply has no `S`, so it can't be played yet. */
  toLevelData(): LevelData {
    const n = this.numbers;
    const data: LevelData = {
      name: this.name.trim() || "Untitled",
      lemmingCount: n.lemmingCount,
      requiredToSave: n.requiredToSave,
      map: this.snapshot(),
    };
    if (n.releaseRate !== RELEASE_RATE_DEFAULT) data.releaseRate = n.releaseRate;
    if (n.bricks > 0) data.bricks = n.bricks;
    const charges = (skills: boolean) =>
      Object.fromEntries(ACTION_ORDER.filter((id) => isSkill(id) === skills && n[id] > 0).map((id) => [id, n[id]]));
    const tools = charges(false);
    const skills = charges(true);
    if (Object.keys(tools).length) data.tools = tools;
    if (Object.keys(skills).length) data.skills = skills;
    return data;
  }

  /** The level as a TypeScript object literal in the style of `levels.ts`, ready to paste into `LEVELS`. */
  toSource(): string {
    const d = this.toLevelData();
    const inline = (o: object) => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(", ")} }`;
    const lines = [
      `  {`,
      `    name: ${JSON.stringify(d.name)},`,
      `    lemmingCount: ${d.lemmingCount},`,
      `    requiredToSave: ${d.requiredToSave},`,
    ];
    if (d.releaseRate !== undefined) lines.push(`    releaseRate: ${d.releaseRate},`);
    if (d.bricks !== undefined) lines.push(`    bricks: ${d.bricks},`);
    if (d.tools) lines.push(`    tools: ${inline(d.tools)},`);
    if (d.skills) lines.push(`    skills: ${inline(d.skills)},`);
    lines.push(`    map: [`, ...d.map.map((row) => `      ${JSON.stringify(row)},`), `    ],`, `  },`);
    return lines.join("\n");
  }

  /* Internals */

  /** The map as ASCII rows, with `S` at the hatch. */
  private snapshot(): string[] {
    const rows: string[] = [];
    for (let y = 0; y < this.grid.rows; y++) {
      let row = "";
      for (let x = 0; x < this.grid.cols; x++) {
        row += this.spawn?.x === x && this.spawn.y === y ? SPAWN_CHAR : TILE_CHARS[this.grid.get(x, y)];
      }
      rows.push(row);
    }
    return rows;
  }

  private record(base: string[]): void {
    this.undoStack.push(base);
    this.redoStack = [];
  }

  /** Show `rows` as the map. Throws on a malformed map, before anything has changed. */
  private loadRows(rows: readonly string[]): void {
    const { grid, spawn } = parseMap({ name: this.name, map: rows });
    this.setMap(grid, spawn);
  }

  /** Adopt a parsed map: in place when the size is unchanged (so listeners redraw), otherwise on the new grid. */
  private setMap(grid: Grid, spawn: TilePoint | null): void {
    this.spawn = spawn;
    if (grid.cols === this.grid.cols && grid.rows === this.grid.rows) {
      grid.forEach((x, y, tile) => this.grid.set(x, y, tile));
    } else {
      this.grid = grid;
    }
  }

  private applyData(data: LevelData): void {
    // Parse first: a malformed map throws before anything has changed.
    const { grid, spawn } = parseMap(data);
    this.name = data.name;
    this.setMap(grid, spawn);
    const n = DEFAULT_NUMBERS();
    Object.assign(n, {
      lemmingCount: data.lemmingCount,
      requiredToSave: data.requiredToSave,
      releaseRate: data.releaseRate ?? RELEASE_RATE_DEFAULT,
      bricks: data.bricks ?? 0,
    });
    for (const id of ACTION_ORDER) n[id] = (isSkill(id) ? data.skills?.[id] : data.tools?.[id]) ?? 0;
    for (const field of DRAFT_FIELDS) this.setNumber(field.id, n[field.id]);
  }
}
