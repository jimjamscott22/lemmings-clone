// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXED_TIMESTEP } from "../config";
import type { Crowd } from "../entities/Crowd";
import type { World } from "../entities/World";
import type { Input } from "../input/Input";
import { Progress } from "../progress/Progress";
import type { Toolbox } from "../tools/Toolbox";
import type { LevelData } from "../world/Level";
import { TileType } from "../world/TileType";
import { Game } from "./Game";

vi.mock("../render/Renderer", () => ({ Renderer: class {
  setLevel() {}
  setSpawn() {}
  draw() {}
} }));
vi.mock("../audio/GameAudio", () => ({ GameAudio: class {
  play() {}
  stop() {}
  setEnabled() {}
  debug() { return {}; }
} }));

interface InternalGame {
  update(dt: number): void;
  input: Input;
  session: { crowd: Crowd; world: World; tools: Toolbox };
}

const LEVEL: LevelData = {
  name: "Input test", lemmingCount: 3, requiredToSave: 1,
  tools: { dig: 10 }, skills: { climber: 1 },
  map: ["..#.......", ".S......G.", "XXXXXXXXXX"],
};

function key(code: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { code }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code }));
}

describe("input across sessions", () => {
  let game: Game;
  let internal: InternalGame;
  let canvas: HTMLCanvasElement;
  let listeners: ReturnType<typeof vi.spyOn>;

  function pointer(type: string, clientX = 40, clientY = 8): void {
    canvas.dispatchEvent(new PointerEvent(type, { button: 0, pointerId: 1, clientX, clientY }));
  }

  beforeEach(() => {
    const html = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.body.querySelectorAll("script").forEach((script) => script.remove());
    document.body.innerHTML = parsed.body.innerHTML;
    vi.stubGlobal("Option", function Option(text: string, value: string) {
      const option = document.createElement("option");
      option.text = text;
      option.value = value;
      return option;
    });
    listeners = vi.spyOn(window, "addEventListener");
    canvas = document.getElementById("game") as HTMLCanvasElement;
    game = new Game(canvas, document.getElementById("viewport")!, [LEVEL], new Progress(null));
    internal = game as unknown as InternalGame;
    game.loadLevel(0);
    canvas.width = 160;
    canvas.height = 48;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 160, height: 48 } as DOMRect);
    canvas.setPointerCapture = vi.fn();
  });

  afterEach(() => {
    for (const [type, listener, options] of listeners?.mock.calls ?? []) window.removeEventListener(type, listener, options);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("consumes Escape during campaign play before a shared level is opened", () => {
    key("Escape");
    internal.update(FIXED_TIMESTEP);
    expect(internal.input.consumePress("Escape")).toBe(false);
    game.playShared(LEVEL);
    internal.update(FIXED_TIMESTEP);
    expect(game.debug()).toMatchObject({ mode: "shared" });
    key("Escape");
    internal.update(FIXED_TIMESTEP);
    expect(game.debug()).toMatchObject({ mode: "edit" });
  });

  it("drops a terrain click queued before restarting, but accepts a fresh click", () => {
    pointer("pointerdown");
    pointer("pointerup");
    key("KeyR");
    internal.update(FIXED_TIMESTEP);
    expect(internal.session.tools.charges.dig).toBe(10);
    expect(internal.session.world.grid.get(2, 0)).toBe(TileType.Dirt);
    pointer("pointerdown");
    pointer("pointerup");
    internal.update(FIXED_TIMESTEP);
    expect(internal.session.tools.charges.dig).toBe(9);
    expect(internal.session.world.grid.get(2, 0)).toBe(TileType.Empty);
  });

  it("ends an ongoing drag and held release-rate key when restarting", () => {
    pointer("pointerdown");
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Equal" }));
    game.restart();
    pointer("pointermove");
    internal.update(FIXED_TIMESTEP);
    expect(internal.session.tools.charges.dig).toBe(10);
    expect(internal.input.isDown("Equal")).toBe(false);
    expect(internal.session.crowd.releaseRate).toBe(50);
  });

  it("drops pending skill clicks when opening a shared level", () => {
    pointer("pointerdown", 24, 27);
    pointer("pointerup", 24, 27);
    game.playShared(LEVEL);
    internal.session.tools.select("climber");
    internal.session.crowd.update(internal.session.world, FIXED_TIMESTEP);
    internal.update(FIXED_TIMESTEP);
    internal.update(FIXED_TIMESTEP);
    expect(game.debug()).toMatchObject({ mode: "shared" });
    expect(internal.session.tools.charges.climber).toBe(1);
    expect(internal.session.crowd.lemmings[0]!.climber).toBe(false);
  });
});
