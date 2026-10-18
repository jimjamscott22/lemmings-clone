import { describe, expect, it } from "vitest";
import { Crowd } from "./Crowd";
import type { SimulationEvent, World } from "./World";
import { run, setup } from "../test/sim";
import { parseLevel } from "../world/Level";
import { BOMB_FUSE, SWIM_ENDURANCE } from "../config";
import { TileType } from "../world/TileType";

describe("sound presentation events", () => {
  it("opens the hatch once and celebrates each rescue once", () => {
    const level = parseLevel({ name: "events", lemmingCount: 3, requiredToSave: 3, map: ["S...G", "#####"] });
    const crowd = new Crowd(level);
    const events: SimulationEvent[] = [];
    const world: World = { grid: level.grid, lemmings: crowd.lemmings, onEvent: (event) => events.push(event) };
    for (let i = 0; i < 60 * 15 && !crowd.finished; i++) crowd.update(world, 1 / 60);
    expect(crowd.saved).toBe(3);
    expect(events.filter((e) => e === "hatch")).toHaveLength(1);
    expect(events.filter((e) => e === "exit")).toHaveLength(3);
  });

  it("splashes only on water entry, not every swimming update", () => {
    const { world, lemming } = setup([".S.......", "###~#####", "#########"]);
    const events: SimulationEvent[] = [];
    const observed: World = { ...world, onEvent: (event) => events.push(event) };
    lemming.setState("walking", observed);
    run(observed, lemming, 5, () => lemming.col === 6);
    expect(events).toEqual(["splash"]);
  });

  it("sounds automatic digging once per removed tile", () => {
    const { world, lemming } = setup([".....##...", ".S...##...", "##########"]);
    const events: SimulationEvent[] = [];
    const observed: World = { ...world, onEvent: (event) => events.push(event) };
    lemming.setState("walking", observed);
    run(observed, lemming, 10, () => lemming.col === 8);
    expect(events).toEqual(["dig", "dig"]);
  });

  it("does not sound a cut when another actor already removed the dirt", () => {
    const { world, lemming } = setup(["........", ".S......", "########"]);
    const events: SimulationEvent[] = [];
    const observed: World = { ...world, onEvent: (event) => events.push(event) };
    lemming.setState("digging", observed);
    run(observed, lemming, 1);
    expect(events).toEqual([]);
  });

  it("announces drowning once when endurance runs out, not on water entry", () => {
    const { world, lemming } = setup(["X..X", "XS~X", "X~~X", "XXXX"]);
    const events: SimulationEvent[] = [];
    const observed: World = { ...world, onEvent: (event) => events.push(event) };
    world.grid.set(lemming.col, lemming.bodyRow, TileType.Water);
    lemming.setState("swimming", observed);
    run(observed, lemming, SWIM_ENDURANCE - 0.1);
    expect(events).toEqual(["splash"]);
    run(observed, lemming, 2);
    expect(lemming.fate).toBe("lost");
    expect(events).toEqual(["splash", "drown"]);
  });

  it("announces a fatal landing once and keeps safe floater landings silent", () => {
    for (const floater of [false, true]) {
      const { world, lemming } = setup([".S.", ...Array<string>(16).fill("..."), "XXX"]);
      const events: SimulationEvent[] = [];
      const observed: World = { ...world, onEvent: (event) => events.push(event) };
      lemming.floater = floater;
      run(observed, lemming, 15);
      expect(events).toEqual(floater ? [] : ["fall"]);
      expect(lemming.fate).toBe(floater ? "active" : "lost");
    }
  });

  it("announces falling out of the map once", () => {
    const { world, lemming } = setup([".S.", "..."]);
    const events: SimulationEvent[] = [];
    const observed: World = { ...world, onEvent: (event) => events.push(event) };
    run(observed, lemming, 5);
    expect(lemming.fate).toBe("lost");
    expect(events).toEqual(["fall"]);
  });

  it("warns once in the final second of a fuse, and never after rescue", () => {
    for (const rescued of [false, true]) {
      const { world, lemming } = setup([".S..G", "XXXXX"]);
      const events: SimulationEvent[] = [];
      const observed: World = { ...world, onEvent: (event) => events.push(event) };
      lemming.lightFuse();
      lemming.setState("blocking", observed);
      if (rescued) lemming.setState("exiting", observed);
      run(observed, lemming, BOMB_FUSE - 1.1);
      expect(events).toEqual(rescued ? ["exit"] : []);
      run(observed, lemming, 2);
      expect(events).toEqual(rescued ? ["exit"] : ["warning"]);
    }
  });
});
