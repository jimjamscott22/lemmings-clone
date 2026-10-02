import { describe, expect, it } from "vitest";
import { parseLevel } from "../world/Level";
import { TileType } from "../world/TileType";
import { tilesOnLine, Toolbox } from "./Toolbox";

const level = () =>
  parseLevel({
    name: "t",
    lemmingCount: 1,
    requiredToSave: 1,
    tools: { dig: 3, build: 2 },
    map: ["S.....", "......", "###XX#"],
  });

describe("tilesOnLine", () => {
  it("covers every cell between two points", () => {
    expect(tilesOnLine({ x: 0, y: 0 }, { x: 3, y: 0 })).toHaveLength(4);
    expect(tilesOnLine({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });
});

describe("Toolbox", () => {
  it("digs diggable tiles along a drag, spending one charge each, skipping walls", () => {
    const lv = level();
    const tools = new Toolbox(lv);
    tools.stroke({ x: 1, y: 2 });
    tools.stroke({ x: 5, y: 2 }); // jumps over 2..4 in one sample
    expect(lv.grid.get(1, 2)).toBe(TileType.Empty);
    expect(lv.grid.get(2, 2)).toBe(TileType.Empty);
    expect(lv.grid.get(3, 2)).toBe(TileType.Wall);
    expect(lv.grid.get(5, 2)).toBe(TileType.Empty);
    expect(tools.charges.dig).toBe(0);
  });

  it("builds only into empty space, never on the hatch, and stops when out of charges", () => {
    const lv = level();
    const tools = new Toolbox(lv);
    tools.select("build");
    tools.stroke({ x: 0, y: 0 }); // spawn tile
    expect(lv.grid.get(0, 0)).toBe(TileType.Empty);
    tools.stroke({ x: 4, y: 0 });
    expect(tools.charges.build).toBe(0);
    expect([1, 2, 3, 4].map((x) => lv.grid.get(x, 0))).toEqual([
      TileType.Bridge,
      TileType.Bridge,
      TileType.Empty,
      TileType.Empty,
    ]);
    expect(tools.canUseAt({ x: 5, y: 0 })).toBe(false);
  });

  it("does not connect separate strokes", () => {
    const lv = level();
    const tools = new Toolbox(lv);
    tools.stroke({ x: 0, y: 2 });
    tools.endStroke();
    tools.stroke({ x: 2, y: 2 });
    expect(lv.grid.get(1, 2)).toBe(TileType.Dirt);
  });
});
