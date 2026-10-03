import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../config";
import { run, setup, tileX } from "../test/sim";
import { TileType } from "../world/TileType";

describe("Lemming state machine", () => {
  it("jumps onto a one-tile step and keeps walking", () => {
    const { world, lemming } = setup([
      "........",
      ".S..X...",
      "########",
    ]);
    lemming.setState("walking", world);
    const seen = new Set<string>();
    run(world, lemming, 6, () => (seen.add(lemming.state.name), tileX(lemming.x) === 6));
    expect(seen).toContain("jumping");
    expect(tileX(lemming.x)).toBe(6);
    expect(lemming.y).toBe(2 * TILE_SIZE); // back on the main floor past the step
  });

  it("digs a tunnel through dirt", () => {
    const { world, lemming } = setup([
      ".....##...",
      ".S...##...",
      "##########",
    ]);
    lemming.setState("walking", world);
    run(world, lemming, 10, () => tileX(lemming.x) === 8);
    expect(world.grid.get(5, 1)).toBe(TileType.Empty);
    expect(world.grid.get(6, 1)).toBe(TileType.Empty);
    expect(world.grid.get(5, 0)).toBe(TileType.Dirt); // only the body row is tunnelled
    expect(tileX(lemming.x)).toBe(8);
  });

  it("turns around at a tall wall without bricks", () => {
    const { world, lemming } = setup([
      "....X",
      ".S..X",
      "#####",
    ]);
    lemming.setState("walking", world);
    run(world, lemming, 4, () => lemming.dir === -1);
    expect(lemming.dir).toBe(-1);
    expect(lemming.state.name).toBe("walking");
  });

  it("builds a bridge stack to climb a tall wall, then jumps over", () => {
    const { world, lemming } = setup([
      "........",
      "....X...",
      ".S..X...",
      "########",
    ]);
    lemming.bricks = 3;
    lemming.setState("walking", world);
    run(world, lemming, 10, () => tileX(lemming.x) === 6 && lemming.y === 3 * TILE_SIZE);
    expect(world.grid.get(3, 2)).toBe(TileType.Bridge);
    expect(lemming.bricks).toBe(2);
    expect(tileX(lemming.x)).toBe(6);
  });

  it("climbs out of several tiles stacked on it in one tick", () => {
    const { world, lemming } = setup([
      "....",
      "....",
      "....",
      ".S..",
      "####",
    ]);
    lemming.setState("walking", world);
    world.grid.set(1, 3, TileType.Bridge);
    world.grid.set(1, 2, TileType.Bridge);
    run(world, lemming, 0.05);
    expect(lemming.y).toBe(2 * TILE_SIZE);
    expect(lemming.fate).toBe("active");
  });

  it("is crushed when sealed in with no way out", () => {
    const { world, lemming } = setup([
      ".X..",
      ".X..",
      ".X..",
      ".S..",
      "####",
    ]);
    world.grid.set(1, 3, TileType.Bridge);
    run(world, lemming, 0.05);
    expect(lemming.fate).toBe("lost");
  });

  it("pops up onto a tile that appears where it is standing", () => {
    const { world, lemming } = setup([
      "....",
      ".S..",
      "####",
    ]);
    lemming.setState("walking", world);
    world.grid.set(1, 1, TileType.Bridge);
    run(world, lemming, 0.05);
    expect(lemming.y).toBe(TILE_SIZE);
  });
});
