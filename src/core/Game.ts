import { Crowd } from "../entities/Crowd";
import type { World } from "../entities/World";
import { Input } from "../input/Input";
import { Renderer } from "../render/Renderer";
import { Hud } from "../ui/Hud";
import { parseLevel, type Level, type LevelData } from "../world/Level";
import { GameLoop } from "./GameLoop";

/**
 * Top-level orchestrator: owns the loop, the current level, and wires
 * input → simulation → rendering → HUD.
 */
export class Game {
  private readonly loop: GameLoop;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly hud = new Hud();

  private level: Level | null = null;
  private crowd: Crowd | null = null;
  /** Simulated seconds since the level started (frozen while paused). */
  private time = 0;
  private paused = false;
  private showGrid = false;

  constructor(canvas: HTMLCanvasElement, viewport: HTMLElement) {
    this.renderer = new Renderer(canvas, viewport);
    this.input = new Input(canvas);
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
  }

  loadLevel(data: LevelData): void {
    this.level = parseLevel(data);
    this.crowd = new Crowd(this.level);
    this.time = 0;
    this.renderer.setLevel(this.level);
    this.hud.setLevelName(data.name);
  }

  start(): void {
    this.loop.start();
  }

  /** Snapshot for the dev console and automated checks. */
  debug(): object {
    const c = this.crowd;
    return {
      time: +this.time.toFixed(2),
      released: c?.released,
      saved: c?.saved,
      lost: c?.lost,
      lemmings: c?.lemmings.map((l) => `${l.state.name}@${l.col},${l.bodyRow}`),
    };
  }

  private update(dt: number): void {
    this.handleKeys();
    if (this.paused) return;
    this.time += dt;
    if (this.level && this.crowd) {
      const world: World = { grid: this.level.grid };
      this.crowd.update(world, dt);
    }
  }

  private handleKeys(): void {
    if (this.input.consumePress("KeyG")) this.showGrid = !this.showGrid;
    if (this.input.consumePress("Space")) {
      this.paused = !this.paused;
      this.hud.setPaused(this.paused);
    }
  }

  private render(): void {
    if (!this.level || !this.crowd) return;
    const hoverTile = this.input.pointerTile();

    this.renderer.draw({ time: this.time, showGrid: this.showGrid, hoverTile, lemmings: this.crowd.lemmings });
    this.hud.setHoverTile(this.level.grid, hoverTile);
    this.hud.setFps(this.loop.fps, performance.now());
  }
}
