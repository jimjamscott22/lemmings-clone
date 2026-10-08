import { describe, expect, it } from "vitest";
import { Crowd } from "./Crowd";
import type { SimulationEvent, World } from "./World";
import { run, setup } from "../test/sim";
import { parseLevel } from "../world/Level";

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
});
