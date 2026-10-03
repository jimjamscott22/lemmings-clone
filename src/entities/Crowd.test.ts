import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP, RELEASE_RATE_DEFAULT, RELEASE_RATE_MAX, RELEASE_RATE_MIN, SPAWN_INTERVAL } from "../config";
import { parseLevel, type LevelData } from "../world/Level";
import { Crowd, releaseInterval } from "./Crowd";

/** A long sealed floor so nobody is saved or lost during the test. */
const DATA: LevelData = {
  name: "test",
  map: ["XS......................X", "XXXXXXXXXXXXXXXXXXXXXXXXX"],
  lemmingCount: 50,
  requiredToSave: 1,
};

function makeCrowd(data: Partial<LevelData> = {}) {
  const level = parseLevel({ ...DATA, ...data });
  const crowd = new Crowd(level);
  const world = { grid: level.grid, lemmings: crowd.lemmings };
  const runFor = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / FIXED_TIMESTEP); i++) crowd.update(world, FIXED_TIMESTEP);
  };
  return { crowd, runFor };
}

describe("release rate", () => {
  it("maps the default rate to the base spawn interval, faster rates to shorter ones", () => {
    expect(releaseInterval(RELEASE_RATE_DEFAULT)).toBeCloseTo(SPAWN_INTERVAL);
    expect(releaseInterval(RELEASE_RATE_MAX)).toBeLessThan(releaseInterval(RELEASE_RATE_DEFAULT));
    expect(releaseInterval(RELEASE_RATE_MIN)).toBeGreaterThan(releaseInterval(RELEASE_RATE_DEFAULT));
    expect(releaseInterval(RELEASE_RATE_MAX)).toBeGreaterThan(0);
  });

  it("starts at the level's rate, or the default", () => {
    expect(makeCrowd().crowd.releaseRate).toBe(RELEASE_RATE_DEFAULT);
    expect(makeCrowd({ releaseRate: 20 }).crowd.releaseRate).toBe(20);
  });

  it("clamps adjustments to the valid range", () => {
    const { crowd } = makeCrowd();
    crowd.adjustReleaseRate(1000);
    expect(crowd.releaseRate).toBe(RELEASE_RATE_MAX);
    crowd.adjustReleaseRate(-1000);
    expect(crowd.releaseRate).toBe(RELEASE_RATE_MIN);
  });

  it("releases more lemmings in the same time at a higher rate", () => {
    const slow = makeCrowd({ releaseRate: RELEASE_RATE_MIN });
    const fast = makeCrowd({ releaseRate: RELEASE_RATE_MAX });
    slow.runFor(10);
    fast.runFor(10);
    expect(fast.crowd.released).toBeGreaterThan(slow.crowd.released);
  });

  it("applies a rate change to the release already counting down", () => {
    const { crowd, runFor } = makeCrowd({ releaseRate: RELEASE_RATE_MIN });
    runFor(0.1); // first lemming drops immediately
    expect(crowd.released).toBe(1);
    crowd.adjustReleaseRate(RELEASE_RATE_MAX);
    runFor(releaseInterval(RELEASE_RATE_MAX) + 0.05);
    expect(crowd.released).toBe(2);
  });
});
