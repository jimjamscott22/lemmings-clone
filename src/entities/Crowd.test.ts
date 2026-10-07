import { describe, expect, it } from "vitest";
import { BOMB_FUSE, FIXED_TIMESTEP, RELEASE_RATE_DEFAULT, RELEASE_RATE_MAX, RELEASE_RATE_MIN, SPAWN_INTERVAL } from "../config";
import { parseLevel, type LevelData } from "../world/Level";
import { LEVELS } from "../world/levels";
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

describe("spawning", () => {
  it("a hatch far below the top of the map doesn't splat its lemmings on the first landing", () => {
    // Fall damage is measured from where the fall started, which for a fresh spawn is the hatch itself.
    const map = ["X.......X", "X.......X", "X.......X", "X.......X", "X.......X", "X.......X", "X.......X", "X.......X", "X.......X", "X.......X", "XS......X", "X.......X", "X.......X", "XXXXXXXXX"];
    const { crowd, runFor } = makeCrowd({ map, lemmingCount: 1 });
    runFor(1);
    expect(crowd.lemmings[0]?.state.name).toBe("walking");
  });
});

describe("nuke", () => {
  it("stops the release, counts the lemmings still in the hatch as lost, and blows up everyone in play", () => {
    const { crowd, runFor } = makeCrowd({ lemmingCount: 10 });
    runFor(4); // a few are out
    const out = crowd.released;
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(10);

    crowd.nuke();
    expect(crowd.nuked).toBe(true);
    expect(crowd.released).toBe(10);
    expect(crowd.lost).toBe(10 - out);
    expect(crowd.lemmings.every((l) => l.fuse === BOMB_FUSE)).toBe(true);

    runFor(BOMB_FUSE + 0.5);
    expect(crowd.lemmings).toHaveLength(0);
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBe(0);
    expect(crowd.lost).toBe(10);
  });

  it("still saves a lemming that reaches the exit before its fuse runs out", () => {
    const { crowd, runFor } = makeCrowd({ map: ["XS.G....X", "XXXXXXXXX"], lemmingCount: 1 });
    runFor(0.1);
    crowd.nuke();
    runFor(BOMB_FUSE + 0.5);
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBe(1);
    expect(crowd.lost).toBe(0);
  });

  it("is idempotent", () => {
    const { crowd, runFor } = makeCrowd({ lemmingCount: 10 });
    runFor(3);
    crowd.nuke();
    const lost = crowd.lost;
    runFor(1);
    const fuse = crowd.lemmings[0]!.fuse;
    crowd.nuke();
    expect(crowd.lost).toBe(lost);
    expect(crowd.lemmings[0]!.fuse).toBe(fuse); // not re-lit
  });

  it("ends a level that could never end by itself", () => {
    // Level 6 without a single Climber: everyone paces in front of the wall forever.
    const level = parseLevel(LEVELS[5]!);
    const crowd = new Crowd(level);
    const world = { grid: level.grid, lemmings: crowd.lemmings };
    const step = () => crowd.update(world, FIXED_TIMESTEP);
    for (let i = 0; i < 60 / FIXED_TIMESTEP; i++) step();
    expect(crowd.finished).toBe(false);

    crowd.nuke();
    for (let i = 0; i < (BOMB_FUSE + 1) / FIXED_TIMESTEP; i++) step();
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBe(0);
  });

  it("nuking before anyone is out ends the level at once", () => {
    const { crowd } = makeCrowd({ lemmingCount: 5 });
    crowd.nuke();
    expect(crowd.finished).toBe(true);
    expect(crowd.lost).toBe(5);
  });
});
