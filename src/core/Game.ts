import { RELEASE_RATE_HOLD_SPEED } from "../config";
import { Crowd } from "../entities/Crowd";
import type { World } from "../entities/World";
import { Input } from "../input/Input";
import type { Progress } from "../progress/Progress";
import { Renderer } from "../render/Renderer";
import { ACTION_ORDER, actionInfo } from "../tools/actions";
import { Toolbox } from "../tools/Toolbox";
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

const RATE_UP_KEYS = ["Equal", "NumpadAdd"];
const RATE_DOWN_KEYS = ["Minus", "NumpadSubtract"];
/** Seconds a +/- key must be held before the rate starts auto-repeating. */
const RATE_REPEAT_DELAY = 0.3;

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
  /** Seconds the current +/- key has been held, and fractional rate points not yet applied. */
  private rateHeldFor = 0;
  private rateCarry = 0;

  constructor(
    canvas: HTMLCanvasElement,
    viewport: HTMLElement,
    private readonly levels: readonly LevelData[],
    private readonly progress: Progress,
  ) {
    this.renderer = new Renderer(canvas, viewport);
    this.input = new Input(canvas);
    this.hud = new Hud({
      onSelectTool: (id) => this.session?.tools.select(id),
      onAdjustRate: (delta) => this.session?.crowd.adjustReleaseRate(delta),
      onSelectLevel: (index) => this.loadLevel(index),
    });
    this.overlay = new ResultOverlay({ onRetry: () => this.restart(), onNext: () => this.nextLevel() });
    byId("hud-restart").addEventListener("click", () => this.restart());
    byId("hud-reset-progress").addEventListener("click", () => this.resetProgress());
    this.showGrid = progress.settings.showGrid;
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
    const crowd = new Crowd(level);
    this.session = {
      level,
      world: { grid: level.grid, lemmings: crowd.lemmings },
      crowd,
      tools: new Toolbox(level),
      outcome: null,
    };
    this.time = 0;
    this.renderer.setLevel(level);
    this.progress.setLastLevel(data.name);
    this.refreshProgress();
    this.overlay.hide();
  }

  restart(): void {
    this.loadLevel(this.levelIndex);
  }

  /** Advance after a win; wraps back to the first level after the last. */
  nextLevel(): void {
    this.loadLevel((this.levelIndex + 1) % this.levels.length);
  }

  /** Forget solved levels and bests (after confirming), then restart the current level. */
  resetProgress(): void {
    if (!confirm("Forget which levels you've solved and all your best scores?")) return;
    this.progress.reset();
    this.showGrid = false;
    this.restart();
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
      lemmings: c?.lemmings.map(
        (l) =>
          `${l.state.name}@${l.col},${l.bodyRow}` +
          (l.climber ? " climber" : "") +
          (l.floater ? " floater" : "") +
          (l.fuse !== null ? ` fuse=${l.fuse.toFixed(1)}` : ""),
      ),
      progress: this.session && this.progress.get(this.session.level.data.name),
    };
  }

  private update(dt: number): void {
    this.handleKeys();
    if (!this.session) return;
    this.handleReleaseRate(this.session, dt);
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
    const won = session.outcome === "won";
    const update = this.progress.record(level.data.name, { won, saved: crowd.saved, time: this.time });
    this.refreshProgress();
    this.overlay.show({
      won,
      saved: crowd.saved,
      required,
      total: crowd.total,
      hasNext: this.levels.length > 1,
      time: this.time,
      progress: update,
    });
  }

  /** Level picker (with solved marks) and the personal best for the current level. */
  private refreshProgress(): void {
    const entries = this.levels.map(({ name }) => ({ name, solved: this.progress.isSolved(name) }));
    this.hud.setLevels(entries, this.levelIndex);
    const data = this.levels[this.levelIndex]!;
    const record = this.progress.get(data.name);
    this.hud.setBest(
      record.attempts > 0 ? { saved: record.bestSaved, total: data.lemmingCount, fastestWin: record.fastestWin } : null,
    );
  }

  private handleKeys(): void {
    if (this.input.consumePress("KeyG")) {
      this.showGrid = !this.showGrid;
      this.progress.updateSettings({ showGrid: this.showGrid });
    }
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
    for (const id of ACTION_ORDER) {
      if (this.input.consumePress(actionInfo(id).key)) this.session?.tools.select(id);
    }
  }

  /**
   * +/- nudge the release rate by one per tap; holding auto-repeats after a short delay.
   * Works while paused, like terrain editing. `dt` is real (not fast-forwarded) time.
   */
  private handleReleaseRate({ crowd, outcome }: Session, dt: number): void {
    // Always drain presses, so a tap during the result screen doesn't carry over.
    const taps =
      RATE_UP_KEYS.filter((k) => this.input.consumePress(k)).length -
      RATE_DOWN_KEYS.filter((k) => this.input.consumePress(k)).length;
    const dir =
      Number(RATE_UP_KEYS.some((k) => this.input.isDown(k))) - Number(RATE_DOWN_KEYS.some((k) => this.input.isDown(k)));
    if (outcome) return;
    if (taps) crowd.adjustReleaseRate(taps);

    if (dir === 0) {
      this.rateHeldFor = 0;
      this.rateCarry = 0;
      return;
    }
    this.rateHeldFor += dt;
    if (this.rateHeldFor < RATE_REPEAT_DELAY) return;
    this.rateCarry += dt * RELEASE_RATE_HOLD_SPEED;
    const steps = Math.floor(this.rateCarry);
    this.rateCarry -= steps;
    if (steps) crowd.adjustReleaseRate(dir * steps);
  }

  /**
   * Terrain editing and skill assignment work while paused too, so the player can plan.
   * Locked once the level ends.
   */
  private handleTools({ tools, crowd, world, outcome }: Session): void {
    // Always drain, so nothing leaks into the next level.
    const strokes = this.input.consumeStroke();
    const clicks = this.input.consumeClicks();
    if (outcome) return;
    if (tools.selectedSkill) {
      for (const p of clicks) {
        const target = crowd.lemmingAt(p, (l) => tools.canAssign(l));
        if (target) tools.assign(target, world);
      }
      return;
    }
    for (const tile of strokes) {
      if (tile) tools.stroke(tile);
      else tools.endStroke();
    }
  }

  private render(): void {
    if (!this.session) return;
    const { level, crowd, tools } = this.session;
    const hoverTile = this.input.pointerTile();
    const { pointer } = this.input;
    const skillMode = tools.selectedSkill !== null;
    const hoverLemming = skillMode && pointer ? crowd.lemmingAt(pointer, (l) => tools.canAssign(l)) : null;

    this.renderer.draw({
      time: this.time,
      showGrid: this.showGrid,
      hoverTile: skillMode ? null : hoverTile,
      hoverValid: skillMode ? hoverLemming !== null && tools.canAssign(hoverLemming) : hoverTile !== null && tools.canUseAt(hoverTile),
      hoverLemming,
      lemmings: crowd.lemmings,
    });
    this.hud.setHoverTile(level.grid, hoverTile);
    this.hud.setTools(tools.selected, tools.charges);
    this.hud.setStats({ out: crowd.active, saved: crowd.saved, need: level.data.requiredToSave, lost: crowd.lost });
    this.hud.setReleaseRate(crowd.releaseRate);
    this.hud.setFps(this.loop.fps, performance.now());
  }
}
