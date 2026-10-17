// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NUKE_CONFIRM_TIME } from "../config";
import { Game } from "./Game";
import { LEVELS } from "../world/levels";
import { Progress } from "../progress/Progress";

/** Test-only view of private Game fields used by the nuke confirm regression. */
interface TestGame {
  update: (dt: number) => void;
  openLevelSelect: () => void;
  loadLevel: (index: number) => void;
  session: { nuke: { armed: boolean }; crowd: { nuked: boolean } } | null;
}

function mountDom(raw = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8")): void {
  // Parse the checked-in fixture once so removing a script cannot create new markup.
  const fixture = new DOMParser().parseFromString(raw, "text/html");
  for (const script of fixture.querySelectorAll("script")) script.remove();
  document.body.replaceChildren(...fixture.body.childNodes);
}

function pressKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
}

function tick(game: TestGame, dt: number): void {
  game.update(dt);
}

describe("test DOM fixture", () => {
  it.each([
    '<script type="module" src="/src/main.ts"></script>',
    '<ScRiPt>void 0;</ScRiPt >',
    '<script>void 0;</script >',
    '<scr<script></script>ipt>void 0;</script>',
  ])("removes script nodes without reparsing filtered text: %s", (script) => {
    mountDom(`<html><body><canvas id="game"></canvas>${script}</body></html>`);
    expect(document.body.querySelector("script")).toBeNull();
    expect(document.getElementById("game")).toBeInstanceOf(HTMLCanvasElement);
  });

  it("mounts the real game markup without its entry script", () => {
    mountDom();
    expect(document.getElementById("game")).toBeInstanceOf(HTMLCanvasElement);
    expect(document.getElementById("hud-nuke")).not.toBeNull();
    expect(document.body.querySelector("script")).toBeNull();
  });
});

describe("nuke confirm while overlays are open", () => {
  let game: TestGame;

  beforeEach(() => {
    mountDom();
    vi.stubGlobal(
      "Option",
      function Option(text: string, value: string) {
        const opt = document.createElement("option");
        opt.text = text;
        opt.value = value;
        return opt;
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const mockCtx = new Proxy(
      { imageSmoothingEnabled: false } as CanvasRenderingContext2D,
      {
        get: (target, prop) => {
          if (prop in target) return target[prop as keyof CanvasRenderingContext2D];
          if (prop === "canvas") return document.getElementById("game");
          if (prop === "createLinearGradient") return () => ({ addColorStop: vi.fn() });
          return vi.fn();
        },
        set: (target, prop, value) => {
          (target as unknown as Record<string, unknown>)[String(prop)] = value;
          return true;
        },
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (type) {
      if (type === "2d") return mockCtx;
      return null;
    });
    const canvas = document.getElementById("game") as HTMLCanvasElement;
    const viewport = document.getElementById("viewport") as HTMLElement;
    game = new Game(canvas, viewport, LEVELS, new Progress(null)) as unknown as TestGame;
    game.loadLevel(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("disarms after the confirm window while the level select is open", () => {
    pressKey("KeyK");
    tick(game, 1 / 60);
    expect(game.session!.nuke.armed).toBe(true);

    game.openLevelSelect();
    tick(game, NUKE_CONFIRM_TIME + 0.5);

    pressKey("Escape");
    tick(game, 1 / 60);
    expect(game.session!.nuke.armed).toBe(false);

    pressKey("KeyK");
    tick(game, 1 / 60);
    expect(game.session!.crowd.nuked).toBe(false);
    expect(game.session!.nuke.armed).toBe(true);
  });
});
