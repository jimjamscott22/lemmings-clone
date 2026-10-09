import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP } from "../config";
import { Crowd } from "../entities/Crowd";
import type { Lemming } from "../entities/Lemming";
import type { SkillId } from "../skills/skills";
import { Toolbox } from "../tools/Toolbox";
import type { ToolId } from "../tools/tools";
import { parseLevel } from "./Level";
import { LEVELS } from "./levels";

/** Give `skill` to the first lemming that matches `when` (and can take it). Cues fire in order. */
interface Cue {
  skill: SkillId;
  when: (l: Lemming, crowd: Crowd) => boolean;
}

/**
 * Apply drag strokes up front (as a player would while paused), then simulate to the end,
 * handing out skills as their cues come up.
 */
function play(index: number, strokes: Array<[ToolId, [number, number], [number, number]]>, cues: Cue[] = []) {
  const level = parseLevel(LEVELS[index]!);
  const tools = new Toolbox(level);
  for (const [tool, [x1, y1], [x2, y2]] of strokes) {
    tools.select(tool);
    tools.stroke({ x: x1, y: y1 });
    tools.stroke({ x: x2, y: y2 });
    tools.endStroke();
  }
  const crowd = new Crowd(level);
  const world = { grid: level.grid, lemmings: crowd.lemmings };
  const pending = [...cues];
  const deadline = level.data.timeLimit ?? 300;
  for (let i = 0; i < Math.floor(deadline / FIXED_TIMESTEP) && !crowd.finished; i++) {
    const cue = pending[0];
    if (cue) {
      tools.select(cue.skill);
      const target = crowd.lemmings.find((l) => cue.when(l, crowd) && tools.canAssign(l));
      if (target && tools.assign(target, world)) pending.shift();
    }
    crowd.update(world, FIXED_TIMESTEP);
  }
  return { crowd, tools, pending, required: level.data.requiredToSave };
}

const walkingAt = (l: Lemming, col: number, row: number, dir: 1 | -1 = 1) =>
  l.state.name === "walking" && l.col === col && l.bodyRow === row && l.dir === dir;

describe("levels", () => {
  it("all parse", () => {
    for (const data of LEVELS) expect(() => parseLevel(data)).not.toThrow();
  });

  it("have unique names (saved progress is keyed by name)", () => {
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
  });

  it("level 1 is lost without help (the pool drowns everyone who reaches it)", () => {
    const { crowd, required } = play(0, []);
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBeLessThan(required);
  });

  it("level 1 is winnable by bridging the pool", () => {
    const { crowd, required } = play(0, [["build", [31, 13], [37, 13]]]);
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBeGreaterThanOrEqual(required);
  });

  it("level 2 is winnable by bridging the chasm and digging a shaft", () => {
    const { crowd, tools, required } = play(1, [
      ["build", [16, 8], [23, 8]],
      ["dig", [38, 8], [38, 10]],
    ]);
    expect(tools.charges).toMatchObject({ dig: 3, build: 2 });
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBeGreaterThanOrEqual(required);
  });

  it("level 3 can't be won without skills (everyone paces in the pen)", () => {
    const level = parseLevel(LEVELS[2]!);
    const crowd = new Crowd(level);
    const world = { grid: level.grid, lemmings: crowd.lemmings };
    for (let i = 0; i < 60 / FIXED_TIMESTEP; i++) crowd.update(world, FIXED_TIMESTEP);
    expect(crowd.saved).toBe(0);
    expect(crowd.lemmings.every((l) => l.bodyRow === 3)).toBe(true);
  });

  it("level 3 is winnable with a miner, basher, blocker, second miner and bomber", () => {
    const { crowd, pending, required } = play(2, [], [
      { skill: "miner", when: (l) => walkingAt(l, 5, 3) },
      { skill: "basher", when: (l) => l.state.name === "walking" && l.bodyRow === 8 && l.col >= 13 && l.dir === 1 },
      { skill: "miner", when: (l) => walkingAt(l, 27, 8) },
      { skill: "blocker", when: (l) => walkingAt(l, 25, 8) },
      {
        skill: "bomber",
        when: (l, c) => l.state.name === "blocking" && !c.lemmings.some((m) => m.state.name === "mining"),
      },
    ]);
    expect(pending).toEqual([]);
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBeGreaterThanOrEqual(required);
  });

  it("level 3 is also winnable by floating down the cliff", () => {
    const { crowd, required } = play(2, [], [
      { skill: "miner", when: (l) => walkingAt(l, 5, 3) },
      { skill: "basher", when: (l) => l.state.name === "walking" && l.bodyRow === 8 && l.col >= 13 && l.dir === 1 },
      ...Array.from({ length: 3 }, (): Cue => ({ skill: "floater", when: (l) => l.bodyRow === 8 && l.col >= 21 })),
    ]);
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBe(3); // one per floater: not enough on its own
    expect(crowd.saved).toBeLessThan(required);
  });

  /** `n` copies of a cue, to give the same skill to several lemmings in turn. */
  const times = (n: number, cue: Cue): Cue[] => Array.from({ length: n }, () => cue);

  describe("level 4, Turn Back", () => {
    it("is lost without a blocker (everyone walks off the cliff)", () => {
      const { crowd, required } = play(3, []);
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBeLessThan(required);
    });

    it("is winnable with a blocker at the cliff edge", () => {
      const { crowd, pending, required } = play(3, [], [{ skill: "blocker", when: (l) => walkingAt(l, 25, 4) }]);
      expect(pending).toEqual([]);
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBeGreaterThanOrEqual(required);
    });
  });

  describe("level 5, Parachute Drop", () => {
    const bridge: Array<[ToolId, [number, number], [number, number]]> = [["build", [24, 16], [29, 16]]];
    const onPlateau = (l: Lemming) => l.state.name === "walking" && l.bodyRow === 2;

    it("is lost without floaters (the drop is fatal) even with the chasm bridged", () => {
      const { crowd } = play(4, bridge);
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBe(0);
    });

    it("is lost without the bridge, even for floaters", () => {
      const { crowd, required } = play(4, [], times(6, { skill: "floater", when: onPlateau }));
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBeLessThan(required);
    });

    it("is winnable by floating down and bridging the chasm", () => {
      const { crowd, pending, required } = play(4, bridge, times(6, { skill: "floater", when: onPlateau }));
      expect(pending).toEqual([]);
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBeGreaterThanOrEqual(required);
    });
  });

  describe("level 6, Over the Wall", () => {
    const bridge: Array<[ToolId, [number, number], [number, number]]> = [["build", [26, 13], [29, 13]]];
    const beforeWall = (l: Lemming) => l.state.name === "walking" && l.bodyRow === 12 && l.col < 16;

    it("can't be won without climbers (the wall turns everyone back)", () => {
      const { crowd } = play(5, bridge, []);
      expect(crowd.saved).toBe(0);
    });

    it("is lost without the bridge, even for climbers", () => {
      const { crowd, required } = play(5, [], times(6, { skill: "climber", when: beforeWall }));
      expect(crowd.saved).toBeLessThan(required);
    });

    it("is winnable by climbing the wall and bridging the chasm", () => {
      const { crowd, pending, required } = play(5, bridge, times(6, { skill: "climber", when: beforeWall }));
      expect(pending).toEqual([]);
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBeGreaterThanOrEqual(required);
    });
  });

  describe("level 7, Down the Mine", () => {
    it("is lost if the miner starts before the slab (it gives up on the wall)", () => {
      const { crowd, required } = play(6, [], [{ skill: "miner", when: (l) => walkingAt(l, 3, 5) }]);
      expect(crowd.saved).toBeLessThan(required);
    });

    it("is winnable by mining down past the slab", () => {
      const { crowd, pending, required } = play(6, [], [{ skill: "miner", when: (l) => walkingAt(l, 14, 5) }]);
      expect(pending).toEqual([]);
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBeGreaterThanOrEqual(required);
    });
  });

  describe("level 8, Grand Tour", () => {
    const pool: Array<[ToolId, [number, number], [number, number]]> = [["build", [32, 10], [38, 10]]];
    const beforeWall = (l: Lemming) => l.state.name === "walking" && l.bodyRow === 10 && l.col < 14;
    const atBarricade = (l: Lemming) => l.state.name === "walking" && l.bodyRow === 10 && l.col >= 15 && l.col <= 22 && l.dir === 1;
    const climbers = times(8, { skill: "climber", when: beforeWall });

    it("is lost with the dig tool alone (one charge can't tunnel the barricade)", () => {
      const { crowd, required } = play(7, [...pool, ["dig", [24, 10], [26, 10]]], climbers);
      expect(crowd.saved).toBeLessThan(required);
    });

    it("is lost without the bridge", () => {
      const { crowd, required } = play(7, [], [...climbers, { skill: "basher", when: atBarricade }]);
      expect(crowd.saved).toBeLessThan(required);
    });

    it("is winnable by climbing, bashing and bridging", () => {
      const { crowd, pending, required } = play(7, pool, [...climbers, { skill: "basher", when: atBarricade }]);
      expect(pending).toEqual([]);
      expect(crowd.finished).toBe(true);
      expect(crowd.saved).toBeGreaterThanOrEqual(required);
    });
  });
});
