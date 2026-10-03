import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../config";
import { Crowd } from "./Crowd";
import { run, setup, tileX } from "../test/sim";
import { parseLevel } from "../world/Level";

describe("Hazards and the goal", () => {
  it("swims across a one-tile pool and climbs out", () => {
    const { world, lemming } = setup([
      ".S.......",
      "###~#####",
      "#########",
    ]);
    lemming.setState("walking", world);
    const seen = new Set<string>();
    run(world, lemming, 8, () => (seen.add(lemming.state.name), tileX(lemming.x) === 6));
    expect(seen).toContain("swimming");
    expect(lemming.fate).toBe("active");
    expect(tileX(lemming.x)).toBe(6);
    expect(lemming.y).toBe(TILE_SIZE);
  });

  it("drowns in a wide pool", () => {
    const { world, lemming } = setup([
      ".S..........",
      "###~~~~~~###",
      "############",
    ]);
    lemming.setState("walking", world);
    run(world, lemming, 15);
    expect(lemming.done).toBe(true);
    expect(lemming.fate).toBe("lost");
  });

  it("is saved on reaching the goal", () => {
    const { world, lemming } = setup([
      ".S..G.",
      "######",
    ]);
    lemming.setState("walking", world);
    run(world, lemming, 6);
    expect(lemming.done).toBe(true);
    expect(lemming.fate).toBe("saved");
  });

  it("crowd releases everyone and tallies saved and lost", () => {
    const level = parseLevel({
      name: "t",
      lemmingCount: 3,
      requiredToSave: 1,
      map: ["S.....G", "#######"],
    });
    const crowd = new Crowd(level);
    for (let i = 0; i < 60 * 20 && !crowd.finished; i++) crowd.update({ grid: level.grid, lemmings: crowd.lemmings }, 1 / 60);
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBe(3);
    expect(crowd.lost).toBe(0);
  });
});
