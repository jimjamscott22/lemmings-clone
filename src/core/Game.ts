import { RELEASE_RATE_HOLD_SPEED } from "../config";
import { Crowd } from "../entities/Crowd";
import type { World } from "../entities/World";
import { Input } from "../input/Input";
import type { KeyValueStore, Progress } from "../progress/Progress";
import { Renderer } from "../render/Renderer";
import { ACTION_ORDER, actionInfo } from "../tools/actions";
import { Toolbox } from "../tools/Toolbox";
import { byId, Hud } from "../ui/Hud";
import { LevelSelect } from "../ui/LevelSelect";
import { ResultOverlay, type LevelResult } from "../ui/ResultOverlay";
import { parseLevel, type Level, type LevelData } from "../world/Level";
import { EditorMode } from "./EditorMode";
import { GameLoop } from "./GameLoop";

/** Everything that belongs to one attempt at a level; rebuilt from scratch on (re)load. */
interface Session {
  readonly level: Level;
  readonly world: World;
  readonly crowd: Crowd;
  readonly tools: Toolbox;
  /** Set once every lemming is accounted for; the simulation stops. */
  outcome: "won" | "lost" | null;
  /** What the result panel showed, to bring it back after a visit to the level editor. */
  result: LevelResult | null;
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
  private readonly levelSelect: LevelSelect;
  private readonly editor: EditorMode;

  private levelIndex = 0;
  /**
   * The level being tried out instead of a built-in one, or null when a built-in level is being played.
   * It is either the editor's draft (a playtest) or a level opened from a link; neither touches saved progress.
   */
  private playtestData: LevelData | null = null;
  private trial: "editor" | "link" = "editor";
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
    store: KeyValueStore | null = null,
  ) {
    this.renderer = new Renderer(canvas, viewport);
    this.input = new Input(canvas);
    this.hud = new Hud({
      onSelectTool: (id) => this.session?.tools.select(id),
      onAdjustRate: (delta) => this.session?.crowd.adjustReleaseRate(delta),
      onOpenLevels: () => this.openLevelSelect(),
      onOpenEditor: () => this.toggleEditor(),
    });
    this.overlay = new ResultOverlay({
      onRetry: () => this.restart(),
      onNext: () => this.nextLevel(),
      onLevels: () => this.openLevelSelect(),
      onEditor: () => this.openEditor(),
      onEditCopy: () => this.editSharedCopy(),
    });
    this.levelSelect = new LevelSelect({
      onChoose: (index) => this.chooseLevel(index),
      onClose: () => this.levelSelect.close(),
      onReset: () => this.resetProgress(),
    });
    this.editor = new EditorMode({
      input: this.input,
      renderer: this.renderer,
      hud: this.hud,
      levels,
      store,
      onPlaytest: (data) => this.playtest(data),
      onExit: () => this.closeEditor(),
    });
    byId("hud-restart").addEventListener("click", () => this.restart());
    this.showGrid = progress.settings.showGrid;
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
  }

  /** Start (or restart) a built-in level from its pristine map. */
  loadLevel(index: number): void {
    this.levelIndex = index;
    this.playtestData = null;
    const data = this.levels[index]!;
    this.startSession(data);
    this.hud.setMode("play");
    this.hud.setLevelName(`${index + 1}. ${data.name}`);
    this.progress.setLastLevel(data.name);
    this.refreshProgress();
  }

  /** Try out a level from the editor. Nothing is recorded, and it replaces the attempt in progress. */
  playtest(data: LevelData, source: "editor" | "link" = "editor"): void {
    this.editor.leave();
    this.playtestData = data;
    this.trial = source;
    this.startSession(data);
    this.hud.setMode(source === "link" ? "shared" : "playtest");
    this.hud.setLevelName(`${source === "link" ? "Shared" : "Playtest"}: ${data.name}`);
    this.hud.setBest(null);
  }

  /** Play a level that arrived in a link. Like a playtest, it saves nothing and replaces the current attempt. */
  playShared(data: LevelData): void {
    this.playtest(data, "link");
  }

  /** From a shared level's result panel: put a copy in the editor (after asking, since it replaces the draft). */
  private editSharedCopy(): void {
    const data = this.playtestData;
    if (!data || this.trial !== "link") return;
    if (!confirm("Replace the level in the editor with a copy of this one? Your current draft will be overwritten.")) return;
    this.openEditor();
    this.editor.adopt(data);
  }

  /** Build a fresh session from `data` and show it. */
  private startSession(data: LevelData): void {
    const level = parseLevel(data);
    const crowd = new Crowd(level);
    this.session = {
      level,
      world: { grid: level.grid, lemmings: crowd.lemmings },
      crowd,
      tools: new Toolbox(level),
      outcome: null,
      result: null,
    };
    this.time = 0;
    this.renderer.setLevel(level);
    this.overlay.hide();
    this.levelSelect.close();
  }

  /** Open the level editor, or leave it for the game. */
  toggleEditor(): void {
    if (this.editor.isOpen) this.closeEditor();
    else this.openEditor();
  }

  openEditor(): void {
    if (this.editor.isOpen) return;
    this.levelSelect.close();
    this.overlay.hide();
    this.editor.enter();
    this.hud.setMode("edit");
  }

  /**
   * Back to the game. A playtest is dropped for the level it interrupted, a shared level starts over,
   * and anything else carries on as it was.
   */
  closeEditor(): void {
    if (!this.editor.isOpen) return;
    this.editor.leave();
    if (this.playtestData) {
      return this.trial === "link" ? this.playtest(this.playtestData, "link") : this.loadLevel(this.levelIndex);
    }
    this.hud.setMode("play");
    if (!this.session) return;
    this.renderer.setLevel(this.session.level);
    if (this.session.result) this.overlay.show(this.session.result);
  }

  /** Load a level from the level select; locked levels can't be chosen. */
  chooseLevel(index: number): void {
    if (this.progress.isUnlocked(this.levelNames, index)) this.loadLevel(index);
  }

  /** Show the level select. The simulation is frozen while it's open. */
  openLevelSelect(): void {
    this.closeEditor();
    const cards = this.levels.map((data, i) => ({
      name: data.name,
      lemmingCount: data.lemmingCount,
      requiredToSave: data.requiredToSave,
      unlocked: this.progress.isUnlocked(this.levelNames, i),
      record: this.progress.get(data.name),
    }));
    this.levelSelect.open(cards, this.levelIndex);
    // Unhandled presses (e.g. an Esc during play) are still queued; don't let them close it at once.
    this.input.clearPresses();
  }

  private get levelNames(): string[] {
    return this.levels.map((l) => l.name);
  }

  restart(): void {
    if (this.playtestData) this.playtest(this.playtestData, this.trial);
    else this.loadLevel(this.levelIndex);
  }

  /** Advance after a win; wraps back to the first level after the last. */
  nextLevel(): void {
    this.loadLevel((this.levelIndex + 1) % this.levels.length);
  }

  /** Forget solved levels and bests (after confirming), which locks everything but level 1 again. */
  resetProgress(): void {
    if (!confirm("Forget which levels you've solved and all your best scores?")) return;
    this.progress.reset();
    this.showGrid = false;
    this.loadLevel(0);
    this.openLevelSelect();
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
      mode: this.editor.isOpen ? "edit" : this.playtestData ? (this.trial === "link" ? "shared" : "playtest") : "play",
      editor: this.editor.debug(),
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
    if (this.levelSelect.isOpen) return this.handleLevelSelectInput();
    if (this.editor.isOpen) {
      this.handleGridKey();
      return this.editor.update();
    }
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
    const trial = this.playtestData ? this.trial : null;
    // A trial isn't an attempt at a real level: its name may even clash with one.
    const progress = trial ? null : this.progress.record(level.data.name, { won, saved: crowd.saved, time: this.time });
    if (!trial) this.refreshProgress();
    session.result = {
      won,
      saved: crowd.saved,
      required,
      total: crowd.total,
      hasNext: this.levels.length > 1,
      time: this.time,
      trial,
      progress,
    };
    this.overlay.show(session.result);
  }

  /** While the level select is open, only Esc / L (close) count; everything else is dropped. */
  private handleLevelSelectInput(): void {
    if (this.input.consumePress("Escape") || this.input.consumePress("KeyL")) this.levelSelect.close();
    this.input.clearPresses();
    this.input.consumeStroke();
    this.input.consumeClicks();
  }

  /** Solved count and the personal best for the current level. */
  private refreshProgress(): void {
    this.hud.setSolved(this.progress.solvedCount(this.levelNames), this.levels.length);
    const data = this.levels[this.levelIndex]!;
    const record = this.progress.get(data.name);
    this.hud.setBest(
      record.attempts > 0 ? { saved: record.bestSaved, total: data.lemmingCount, fastestWin: record.fastestWin } : null,
    );
  }

  private handleGridKey(): void {
    if (!this.input.consumePress("KeyG")) return;
    this.showGrid = !this.showGrid;
    this.progress.updateSettings({ showGrid: this.showGrid });
  }

  private handleKeys(): void {
    this.handleGridKey();
    if (this.input.consumePress("KeyL")) return this.openLevelSelect();
    if (this.input.consumePress("KeyE")) return this.openEditor();
    if (this.playtestData && this.input.consumePress("Escape")) return this.openEditor();
    if (this.input.consumePress("KeyR")) return this.restart();
    if (this.input.consumePress("KeyN") && this.session?.outcome === "won" && !this.playtestData) return this.nextLevel();
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
    if (this.editor.isOpen) return this.renderEditor();
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

  private renderEditor(): void {
    this.editor.render(performance.now() / 1000, this.showGrid);
    this.hud.setFps(this.loop.fps, performance.now());
  }
}
