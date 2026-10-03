import type { Grid } from "../world/Grid";
import type { TilePoint } from "../world/Level";
import { TileType } from "../world/TileType";

export type ToolId = "dig" | "build";

/** A terrain-editing tool. Each successful `apply` spends one charge. */
export interface Tool {
  readonly id: ToolId;
  readonly name: string;
  /** Keyboard code that selects the tool. */
  readonly key: string;
  readonly hint: string;
  canApply(grid: Grid, x: number, y: number, spawn: TilePoint): boolean;
  apply(grid: Grid, x: number, y: number): void;
}

export const TOOLS: Readonly<Record<ToolId, Tool>> = {
  dig: {
    id: "dig",
    name: "Dig",
    key: "Digit1",
    hint: "Drag to remove dirt or bridge",
    canApply: (grid, x, y) => grid.isDiggable(x, y),
    apply: (grid, x, y) => grid.set(x, y, TileType.Empty),
  },
  build: {
    id: "build",
    name: "Build",
    key: "Digit2",
    hint: "Drag to lay bridge in open air",
    // Only into open air, and never plugging the entrance hatch.
    canApply: (grid, x, y, spawn) =>
      grid.inBounds(x, y) && grid.get(x, y) === TileType.Empty && !(x === spawn.x && y === spawn.y),
    apply: (grid, x, y) => grid.set(x, y, TileType.Bridge),
  },
};

export const TOOL_ORDER: readonly ToolId[] = ["dig", "build"];
