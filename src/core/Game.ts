import { Crowd } from "../entities/Crowd";
import type { World } from "../entities/World";
import { Input } from "../input/Input";
import { Renderer } from "../render/Renderer";
import { Toolbox } from "../tools/Toolbox";
import { TOOL_ORDER, TOOLS } from "../tools/tools";
import { byId, Hud } from "../ui/Hud";
import { ResultOverlay } from "../ui/ResultOverlay";
import { parseLevel, type Level, type LevelData } from "../world/Level";
import { GameLoop } from "./GameLoop";

/** Everything that belongs to one attempt at a level; rebuilt from scratch on (re)load. */
interface Session {
  readonly level: Level;
  readonly world: World;
  readonly crowd: Crowd;
  readonly tools: Toolbox;
  /** Set once every lemming is accounted for; the simulation stops. */
  outcome: "won" | "lost" | null;
}

/** Simulation steps per tick in fast-forward. */
const FAST_SPEED = 3;

/**
 * Top-level orchestrator: owns the loop and the current session, and wires
 * input → simulation → rendering → HUD.
 */
export class Game {
  private readonly loop: GameLoop;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly hud: Hud;
  private readonly overlay: ResultOverlay;

  private levelIndex = 0;
  private session: Session | null = null;
  /** Simulated seconds since the level started (frozen while paused). */
  private time = 0;
  private paused = false;
  private showGrid = false;
  private fast = false;

  constructor(
    canvas: HTMLCanvasElement,
    viewport: HTMLElement,
    private readonly levels: readonly LevelData[],
  ) {
    this.renderer = new Renderer(canvas, viewport);
    this.input = new Input(canvas);
    this.hud = new Hud((id) => this.session?.tools.select(id));
    this.overlay = new ResultOverlay({ onRetry: () => this.restart(), onNext: () => this.nextLevel() });
    byId("hud-restart").addEventListener("click", () => this.restart());
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
  }

  /** Start (or restart) a level from its pristine map. */
  loadLevel(index: number): void {
    this.levelIndex = index;
    const data = this.levels[index]!;
    const level = parseLevel(data);
    this.session = {
      level,
      world: { grid: level.grid },
      crowd: new Crowd(level),
      tools: new Toolbox(level),
      outcome: null,
    };
    this.time = 0;
    this.renderer.setLevel(level);
    this.hud.setLevelName(`${index + 1}. ${data.name}`);
    this.overlay.hide();
  }

  restart(): void {
    this.loadLevel(this.levelIndex);
  }

  /** Advance after a win; wraps back to the first level after the last. */
  nextLevel(): void {
    this.loadLevel((this.levelIndex + 1) % this.levels.length);
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
      outcome: this.session?.outcome,
      tools: this.session?.tools.charges,
      lemmings: c?.lemmings.map((l) => `${l.state.name}@${l.col},${l.bodyRow}`),
    };
  }

  private update(dt: number): void {
    this.handleKeys();
    if (!this.session) return;
    this.handleTools(this.session);
    if (this.session.outcome || this.paused) return;

    const steps = this.fast ? FAST_SPEED : 1;
    for (let i = 0; i < steps; i++) {
      this.time += dt;
      this.session.crowd.update(this.session.world, dt);
    }
    this.checkOutcome(this.session);
  }

  private checkOutcome(session: Session): void {
    const { crowd, level } = session;
    if (!crowd.finished) return;
    const required = level.data.requiredToSave;
    session.outcome = crowd.saved >= required ? "won" : "lost";
    this.overlay.show({
      won: session.outcome === "won",
      saved: crowd.saved,
      required,
      total: crowd.total,
      hasNext: this.levels.length > 1,
    });
  }

  private handleKeys(): void {
    if (this.input.consumePress("KeyG")) this.showGrid = !this.showGrid;
    if (this.input.consumePress("KeyR")) return this.restart();
    if (this.input.consumePress("KeyN") && this.session?.outcome === "won") return this.nextLevel();
    if (this.input.consumePress("KeyF")) {
      this.fast = !this.fast;
      this.hud.setFast(this.fast);
    }
    if (this.input.consumePress("Space")) {
      this.paused = !this.paused;
      this.hud.setPaused(this.paused);
    }
    for (const id of TOOL_ORDER) {
      if (this.input.consumePress(TOOLS[id].key)) this.session?.tools.select(id);
    }
  }

  /** Terrain editing works while paused too, so the player can plan. Locked once the level ends. */
  private handleTools({ tools, outcome }: Session): void {
    const strokes = this.input.consumeStroke(); // always drain, so nothing leaks into the next level
    if (outcome) return;
    for (const tile of strokes) {
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
    this.hud.setStats({ out: crowd.active, saved: crowd.saved, need: level.data.requiredToSave, lost: crowd.lost });
    this.hud.setFps(this.loop.fps, performance.now());
  }
}
