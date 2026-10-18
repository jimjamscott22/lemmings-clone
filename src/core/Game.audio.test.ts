// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameAudio } from "../audio/GameAudio";
import { FIXED_TIMESTEP, LEMMING_HEIGHT, RELEASE_RATE_MAX } from "../config";
import type { Crowd } from "../entities/Crowd";
import type { Input } from "../input/Input";
import { Progress } from "../progress/Progress";
import type { Toolbox } from "../tools/Toolbox";
import type { LevelData } from "../world/Level";
import { Game } from "./Game";

vi.mock("../render/Renderer", () => ({ Renderer: class {
  setLevel() {}
  setSpawn() {}
  draw() {}
} }));
vi.mock("../audio/GameAudio", () => ({ GameAudio: class {
  play = vi.fn();
  stop = vi.fn();
  setEnabled = vi.fn();
  debug() { return {}; }
} }));

interface InternalGame {
  update(dt: number): void;
  audio: GameAudio;
  input: Input;
  session: { crowd: Crowd; tools: Toolbox };
}

const LEVEL: LevelData = {
  name: "Audio test", lemmingCount: 2, requiredToSave: 1,
  skills: { climber: 2 }, map: ["..........", ".S......G.", "XXXXXXXXXX"],
};

function key(code: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { code }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code }));
}

describe("game audio controls", () => {
  let game: Game;
  let internal: InternalGame;
  let listeners: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const html = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1]!.replace(/<script[\s\S]*?<\/script>/g, "");
    vi.stubGlobal("Option", function Option(text: string, value: string) {
      const option = document.createElement("option");
      option.text = text;
      option.value = value;
      return option;
    });
    listeners = vi.spyOn(window, "addEventListener");
    game = new Game(document.getElementById("game") as HTMLCanvasElement, document.getElementById("viewport")!, [LEVEL], new Progress(null));
    internal = game as unknown as InternalGame;
    game.loadLevel(0);
    internal.update(FIXED_TIMESTEP);
    vi.mocked(internal.audio.play).mockClear();
  });

  afterEach(() => {
    for (const [type, listener, options] of listeners?.mock.calls ?? []) window.removeEventListener(type, listener, options);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses matching menu feedback for mouse and keyboard actions", () => {
    document.getElementById("hud-levels")!.click();
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-open");
    key("Escape");
    internal.update(FIXED_TIMESTEP);
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-close");
    key("KeyL");
    internal.update(FIXED_TIMESTEP);
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-open");
    document.getElementById("levels-close")!.click();
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-close");
    document.getElementById("hud-help")!.click();
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-open");
    document.getElementById("help-close")!.click();
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-close");
  });

  it("gives tool and rate controls feedback, with no click at the rate limit", () => {
    document.querySelectorAll<HTMLButtonElement>("#hud-tools button")[2]!.click();
    expect(internal.session.tools.selected).toBe("climber");
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-click");
    key("Digit4");
    internal.update(FIXED_TIMESTEP);
    expect(internal.session.tools.selected).toBe("floater");
    expect(internal.audio.play).toHaveBeenCalledTimes(2);
    key("Equal");
    internal.update(FIXED_TIMESTEP);
    expect(internal.audio.play).toHaveBeenCalledTimes(3);
    internal.session.crowd.adjustReleaseRate(RELEASE_RATE_MAX);
    document.getElementById("hud-rate-up")!.click();
    expect(internal.audio.play).toHaveBeenCalledTimes(3);
  });

  it("plays the nuke voice only on confirmation, then ignores later presses", () => {
    document.getElementById("hud-nuke")!.click();
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-click");
    key("KeyK");
    internal.update(FIXED_TIMESTEP);
    expect(internal.session.crowd.nuked).toBe(true);
    expect(internal.audio.play).toHaveBeenLastCalledWith("nuke");
    document.getElementById("hud-nuke")!.click();
    expect(vi.mocked(internal.audio.play).mock.calls.filter(([event]) => event === "nuke")).toHaveLength(1);
  });

  it("acknowledges success, rejects an invalid assignment, and ignores empty space", () => {
    const lemming = internal.session.crowd.lemmings[0]!;
    internal.session.tools.select("climber");
    const point = { x: lemming.x, y: lemming.y - LEMMING_HEIGHT / 2 };
    vi.spyOn(internal.input, "consumeClicks").mockReturnValueOnce([point]);
    internal.update(FIXED_TIMESTEP);
    expect(internal.audio.play).toHaveBeenLastCalledWith("climber");
    vi.mocked(internal.input.consumeClicks).mockReturnValueOnce([point]);
    internal.update(FIXED_TIMESTEP);
    expect(internal.audio.play).toHaveBeenLastCalledWith("reject");
    vi.mocked(internal.input.consumeClicks).mockReturnValueOnce([{ x: -100, y: -100 }]);
    internal.update(FIXED_TIMESTEP);
    expect(internal.audio.play).toHaveBeenCalledTimes(2);
    expect(internal.session.tools.charges.climber).toBe(1);
  });

  it("keeps assignments silent while paused, while UI controls still give feedback", () => {
    key("Space");
    internal.update(FIXED_TIMESTEP);
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-click");
    vi.mocked(internal.audio.play).mockClear();
    internal.session.tools.select("climber");
    const lemming = internal.session.crowd.lemmings[0]!;
    vi.spyOn(internal.input, "consumeClicks").mockReturnValueOnce([{ x: lemming.x, y: lemming.y - LEMMING_HEIGHT / 2 }]);
    internal.update(FIXED_TIMESTEP);
    expect(lemming.climber).toBe(true);
    expect(internal.audio.play).not.toHaveBeenCalled();
    game.restart();
    expect(internal.audio.play).toHaveBeenLastCalledWith("ui-play");
  });
});
