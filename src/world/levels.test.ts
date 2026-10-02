import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP } from "../config";
import { Crowd } from "../entities/Crowd";
import { Toolbox } from "../tools/Toolbox";
import type { ToolId } from "../tools/tools";
import { parseLevel } from "./Level";
import { LEVELS } from "./levels";

/** Apply drag strokes up front (as a player would while paused), then simulate to the end. */
function play(index: number, strokes: Array<[ToolId, [number, number], [number, number]]>) {
  const level = parseLevel(LEVELS[index]!);
  const tools = new Toolbox(level);
  for (const [tool, [x1, y1], [x2, y2]] of strokes) {
    tools.select(tool);
    tools.stroke({ x: x1, y: y1 });
    tools.stroke({ x: x2, y: y2 });
    tools.endStroke();
  }
  const crowd = new Crowd(level);
  for (let i = 0; i < 300 / FIXED_TIMESTEP && !crowd.finished; i++) crowd.update({ grid: level.grid }, FIXED_TIMESTEP);
  return { crowd, tools, required: level.data.requiredToSave };
}

describe("levels", () => {
  it("all parse", () => {
    for (const data of LEVELS) expect(() => parseLevel(data)).not.toThrow();
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
    expect(tools.charges).toEqual({ dig: 3, build: 2 });
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBeGreaterThanOrEqual(required);
  });
});
