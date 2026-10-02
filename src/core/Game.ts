import { Crowd } from "../entities/Crowd";
import type { World } from "../entities/World";
import { Input } from "../input/Input";
import { Renderer } from "../render/Renderer";
import { Toolbox } from "../tools/Toolbox";
import { TOOL_ORDER, TOOLS } from "../tools/tools";
import { Hud } from "../ui/Hud";
import { parseLevel, type Level, type LevelData } from "../world/Level";
import { GameLoop } from "./GameLoop";

/** Everything that belongs to one attempt at a level; rebuilt from scratch on (re)load. */
interface Session {
  readonly level: Level;
  readonly world: World;
  readonly crowd: Crowd;
  readonly tools: Toolbox;
}

/**
 * Top-level orchestrator: owns the loop and the current session, and wires
 * input → simulation → rendering → HUD.
 */
export class Game {
  private readonly loop: GameLoop;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly hud: Hud;

  private session: Session | null = null;
  /** Simulated seconds since the level started (frozen while paused). */
  private time = 0;
  private paused = false;
  private showGrid = false;

  constructor(canvas: HTMLCanvasElement, viewport: HTMLElement) {
    this.renderer = new Renderer(canvas, viewport);
    this.input = new Input(canvas);
    this.hud = new Hud((id) => this.session?.tools.select(id));
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
  }

  loadLevel(data: LevelData): void {
    const level = parseLevel(data);
    this.session = { level, world: { grid: level.grid }, crowd: new Crowd(level), tools: new Toolbox(level) };
    this.time = 0;
    this.renderer.setLevel(level);
    this.hud.setLevelName(data.name);
  }

  start(): void {
    this.loop.start();
  }

  /** Snapshot for the dev console and automated checks. */
  debug(): object {
    const c = this.session?.crowd;
    return {
      time: +this.time.toFixed(2),
      released: c?.released,
      saved: c?.saved,
      lost: c?.lost,
      tools: this.session?.tools.charges,
      lemmings: c?.lemmings.map((l) => `${l.state.name}@${l.col},${l.bodyRow}`),
    };
  }

  private update(dt: number): void {
    this.handleKeys();
    if (!this.session) return;
    this.handleTools(this.session);
    if (this.paused) return;
    this.time += dt;
    this.session.crowd.update(this.session.world, dt);
  }

  private handleKeys(): void {
    if (this.input.consumePress("KeyG")) this.showGrid = !this.showGrid;
    if (this.input.consumePress("Space")) {
      this.paused = !this.paused;
      this.hud.setPaused(this.paused);
    }
    for (const id of TOOL_ORDER) {
      if (this.input.consumePress(TOOLS[id].key)) this.session?.tools.select(id);
    }
  }

  /** Terrain editing works while paused too, so the player can plan. */
  private handleTools({ tools }: Session): void {
    for (const tile of this.input.consumeStroke()) {
      if (tile) tools.stroke(tile);
      else tools.endStroke();
    }
  }

  private render(): void {
    if (!this.session) return;
    const { level, crowd, tools } = this.session;
    const hoverTile = this.input.pointerTile();

    this.renderer.draw({
      time: this.time,
      showGrid: this.showGrid,
      hoverTile,
      hoverValid: hoverTile !== null && tools.canUseAt(hoverTile),
      lemmings: crowd.lemmings,
    });
    this.hud.setHoverTile(level.grid, hoverTile);
    this.hud.setTools(tools.selected, tools.charges);
    this.hud.setFps(this.loop.fps, performance.now());
  }
}
