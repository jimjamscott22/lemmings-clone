// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXED_TIMESTEP } from "../config";
import type { Crowd } from "../entities/Crowd";
import type { World } from "../entities/World";
import { Progress } from "../progress/Progress";
import type { LevelData } from "../world/Level";
import { Game } from "./Game";

// Keep real game orchestration, input and UI; canvas drawing is irrelevant to deadline behavior.
vi.mock("../render/Renderer", () => ({ Renderer: class {
  setLevel() {}
  setSpawn() {}
  draw() {}
} }));

interface TestGame {
  update(dt: number): void;
  render(): void;
  session: { crowd: Crowd; world: World; outcome: "won" | "lost" | null };
}

const LEVEL: LevelData = {
  name: "Deadline test",
  lemmingCount: 3,
  requiredToSave: 1,
  timeLimit: 1,
  map: ["..........", ".S......G.", "XXXXXXXXXX"],
};

function key(code: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { code }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code }));
}

describe("level deadlines", () => {
  let game: Game;
  let internal: TestGame;
  let progress: Progress;
  const captureListeners = () => vi.spyOn(window, "addEventListener");
  let listeners: ReturnType<typeof captureListeners>;

  function mount(data = LEVEL): void {
    progress = new Progress(null);
    game = new Game(document.getElementById("game") as HTMLCanvasElement, document.getElementById("viewport")!, [data], progress);
    internal = game as unknown as TestGame;
    game.loadLevel(0);
  }

  function ticks(count: number): void {
    for (let i = 0; i < count; i++) internal.update(FIXED_TIMESTEP);
    internal.render();
  }

  beforeEach(() => {
    const raw = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");
    const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(raw)![1]!;
    document.body.innerHTML = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
    vi.stubGlobal("Option", function Option(text: string, value: string) {
      const option = document.createElement("option");
      option.text = text;
      option.value = value;
      return option;
    });
    listeners = captureListeners();
  });

  afterEach(() => {
    for (const [type, listener, options] of listeners.mock.calls) window.removeEventListener(type, listener, options);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ends exactly at the deadline, counts active and unreleased lemmings as lost, and records once", () => {
    mount();
    ticks(59);
    expect(internal.session.outcome).toBeNull();
    expect(document.getElementById("hud-time")!.textContent).toBe("Hurry! 0:01");
    ticks(1);
    expect(game.debug()).toMatchObject({ time: 1, timeRemaining: 0, saved: 0, lost: 3, outcome: "lost" });
    expect(internal.session.crowd.finished).toBe(true);
    expect(document.getElementById("result-title")!.textContent).toBe("Time's up!");
    ticks(120);
    expect(progress.get(LEVEL.name)).toMatchObject({ attempts: 1, wins: 0 });
    expect(game.debug()).toMatchObject({ time: 1 });
  });

  it("counts lemmings already entering the exit and can win at timeout", () => {
    mount();
    ticks(59);
    const { crowd, world } = internal.session;
    crowd.lemmings[0]!.setState("exiting", world);
    ticks(1);
    expect(game.debug()).toMatchObject({ saved: 1, lost: 2, outcome: "won", time: 1 });
    expect(progress.get(LEVEL.name)).toMatchObject({ wins: 1, fastestWin: 1 });
    expect(document.getElementById("result-detail")!.textContent).toContain("Time ran out");
  });

  it("honors pause, help, level select, and editor without consuming simulation time", () => {
    mount();
    key("Space");
    ticks(120);
    expect(game.debug()).toMatchObject({ time: 0, timeRemaining: 1 });
    key("Space");
    ticks(1);
    const before = game.debug();

    key("KeyH");
    ticks(120);
    expect(game.debug()).toMatchObject({ timeRemaining: (before as { timeRemaining: number }).timeRemaining, helpOpen: true });
    document.getElementById("help-close")!.click();
    game.openLevelSelect();
    ticks(120);
    expect(game.debug()).toMatchObject({ timeRemaining: (before as { timeRemaining: number }).timeRemaining });
    game.openEditor();
    ticks(120);
    expect(game.debug()).toMatchObject({ timeRemaining: (before as { timeRemaining: number }).timeRemaining });
    game.closeEditor();
    ticks(59);
    expect(internal.session.outcome).toBe("lost");
  });

  it("uses simulation time at ×3 and stops within the fast-forward batch", () => {
    mount({ ...LEVEL, timeLimit: 1.01 });
    key("KeyF");
    ticks(20);
    expect(game.debug()).toMatchObject({ time: 1, outcome: null });
    ticks(1);
    expect(game.debug()).toMatchObject({ time: 1.01, timeRemaining: 0, outcome: "lost" });
    expect(progress.get(LEVEL.name).attempts).toBe(1);
  });

  it("resets the countdown on restart and does not time out untimed levels", () => {
    mount();
    ticks(60);
    game.restart();
    internal.render();
    expect(game.debug()).toMatchObject({ time: 0, timeRemaining: 1, outcome: null, lost: 0 });
    expect(document.getElementById("hud-time")!.textContent).toBe("Hurry! 0:01");
    game.playtest({ ...LEVEL, timeLimit: undefined });
    ticks(120);
    expect(game.debug()).toMatchObject({ time: 2, timeRemaining: null, outcome: null });
    expect(document.getElementById("hud-time")!.textContent).toBe("Untimed");
  });

  it.each(["editor", "link"] as const)("does not save campaign progress for timed %s trials", (source) => {
    mount();
    game.playtest(LEVEL, source);
    ticks(60);
    expect(internal.session.outcome).toBe("lost");
    expect(progress.get(LEVEL.name).attempts).toBe(0);
  });

  it("finishes normally before the deadline when the crowd clears", () => {
    mount({ ...LEVEL, lemmingCount: 1, timeLimit: 60 });
    ticks(600);
    expect(internal.session.outcome).toBe("won");
    expect(document.getElementById("result-detail")!.textContent).not.toContain("Time ran out");
    expect(progress.get(LEVEL.name).fastestWin).toBeLessThan(60);
  });

  it("shows deadlines on level cards and a configurable timer in the editor", () => {
    mount({ ...LEVEL, timeLimit: 90 });
    game.openLevelSelect();
    expect(document.getElementById("levels-grid")!.textContent).toContain("Time limit 1:30");
    game.openEditor();
    expect(document.body.textContent).toContain("Time (s, 0 = off)");
  });
});
