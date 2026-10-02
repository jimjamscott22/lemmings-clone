import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../config";
import { run, setup, tileX } from "../test/sim";

describe("Lemming walk & fall", () => {
  it("falls from the air and lands on the first solid tile top", () => {
    const { world, lemming } = setup([
      "..S..",
      ".....",
      ".....",
      "#####",
    ]);
    lemming.y -= TILE_SIZE / 2; // start mid-air
    run(world, lemming, 2, () => lemming.state.name === "walking");
    expect(lemming.state.name).toBe("walking");
    expect(lemming.y).toBe(3 * TILE_SIZE);
  });

  it("walks right, and turns around when blocked", () => {
    const { world, lemming } = setup([
      ".S...X",
      "######",
    ]);
    lemming.setState("walking", world);
    run(world, lemming, 3, () => lemming.dir === -1);
    expect(lemming.dir).toBe(-1);
    expect(tileX(lemming.x)).toBe(4);
    expect(lemming.y).toBe(TILE_SIZE); // never left the ground
  });

  it("walks off a ledge and falls", () => {
    const { world, lemming } = setup([
      "S....",
      "##...",
      ".....",
      "#####",
    ]);
    lemming.setState("walking", world);
    run(world, lemming, 2, () => lemming.state.name === "falling");
    expect(lemming.state.name).toBe("falling");
    expect(tileX(lemming.x)).toBe(2);
    run(world, lemming, 2, () => lemming.state.name === "walking");
    expect(lemming.y).toBe(3 * TILE_SIZE);
  });

  it("is lost when it falls out the bottom of the map", () => {
    const { world, lemming } = setup([
      "S....",
      ".....",
    ]);
    run(world, lemming, 3);
    expect(lemming.done).toBe(true);
    expect(lemming.fate).toBe("lost");
  });
});
