import { describe, expect, it } from "vitest";
import { LEGEND, parseMap, SPAWN_CHAR, TILE_CHARS } from "./Level";
import { TileType } from "./TileType";

describe("map legend", () => {
  it("gives every tile type a map character that reads back as that tile (the level editor exports through it)", () => {
    for (const tile of Object.values(TileType)) {
      const ch = TILE_CHARS[tile];
      expect(ch, `TileType ${tile} has no LEGEND character`).toBeDefined();
      expect(LEGEND[ch]).toBe(tile);
    }
  });

  it("keeps the spawn character out of the tile characters", () => {
    expect(Object.values(TILE_CHARS)).not.toContain(SPAWN_CHAR);
  });
});

describe("parseMap", () => {
  it("returns the grid and the spawn, or null spawn when the map has none (a level being drawn)", () => {
    const withSpawn = parseMap({ name: "a", map: ["S#", ".G"] });
    expect(withSpawn.spawn).toEqual({ x: 0, y: 0 });
    expect(withSpawn.grid.get(1, 0)).toBe(TileType.Dirt);
    expect(withSpawn.grid.get(0, 0)).toBe(TileType.Empty);
    expect(parseMap({ name: "b", map: ["..", ".."] }).spawn).toBeNull();
  });

  it("rejects ragged rows and unknown characters", () => {
    expect(() => parseMap({ name: "c", map: ["..", "."] })).toThrow(/row 1/);
    expect(() => parseMap({ name: "d", map: ["?."] })).toThrow(/unknown tile '\?'/);
  });
});
