import { Grid } from "./Grid";
import { TileType } from "./TileType";

export interface TilePoint {
  x: number;
  y: number;
}

/** Authoring format: an ASCII map plus gameplay parameters. */
export interface LevelData {
  name: string;
  /** One string per row; every row must have the same length. See LEGEND. */
  map: readonly string[];
  /** Total lemmings released from the spawn. */
  lemmingCount: number;
  /** Lemmings that must reach the goal to win. */
  requiredToSave: number;
  /** Bridge blocks each lemming carries for auto-building (default 0). */
  bricks?: number;
}

/** A parsed, playable level. */
export interface Level {
  data: LevelData;
  grid: Grid;
  /** Tile the lemmings drop in from. */
  spawn: TilePoint;
}

const SPAWN_CHAR = "S";

export const LEGEND: Readonly<Record<string, TileType>> = {
  ".": TileType.Empty,
  "#": TileType.Dirt,
  "~": TileType.Water,
  X: TileType.Wall,
  "=": TileType.Bridge,
  G: TileType.Goal,
  [SPAWN_CHAR]: TileType.Empty,
};

export function parseLevel(data: LevelData): Level {
  const { map } = data;
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  if (rows === 0 || cols === 0) throw new Error(`Level "${data.name}" has an empty map`);

  const grid = new Grid(cols, rows);
  let spawn: TilePoint | null = null;

  map.forEach((line, y) => {
    if (line.length !== cols) {
      throw new Error(`Level "${data.name}" row ${y} has length ${line.length}, expected ${cols}`);
    }
    for (let x = 0; x < cols; x++) {
      const ch = line[x]!;
      const tile = LEGEND[ch];
      if (tile === undefined) throw new Error(`Level "${data.name}" has unknown tile '${ch}' at (${x}, ${y})`);
      if (ch === SPAWN_CHAR) spawn = { x, y };
      grid.set(x, y, tile);
    }
  });

  if (!spawn) throw new Error(`Level "${data.name}" has no spawn point ('${SPAWN_CHAR}')`);
  return { data, grid, spawn };
}
