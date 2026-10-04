import { loadDraft, saveDraft } from "../editor/draftStore";
import { BRUSHES, LevelDraft, type Brush } from "../editor/LevelDraft";
import { parseLevelText } from "../editor/levelText";
import type { Input } from "../input/Input";
import type { KeyValueStore } from "../progress/Progress";
import type { Renderer } from "../render/Renderer";
import { BRUSH_KEYS, EditorPanel, type PaintTool } from "../ui/EditorPanel";
import type { Hud } from "../ui/Hud";
import type { Grid } from "../world/Grid";
import type { LevelData } from "../world/Level";
import { TileType } from "../world/TileType";

/**
 * The level editor: owns the draft being built, turns pointer and key input into edits, and keeps
 * the canvas and the panel showing it. The game's own session is left untouched while it's open.
 *
 * Drag with the pencil, or click with the fill tool, to paint the selected brush. Anything the
 * author changes is saved to the draft store straight away, so closing the tab loses nothing.
 */
export class EditorMode {
  private readonly draft: LevelDraft;
  private readonly panel: EditorPanel;
  private brush: Brush = TileType.Dirt;
  private tool: PaintTool = "pencil";
  /** A fill happens once per press, not for every tile the drag passes over. */
  private filling = false;
  private open = false;
  /** What the renderer is currently showing, to notice when it needs a new grid or hatch. */
  private shownGrid: Grid | null = null;
  private shownSpawn = "";

  constructor(
    private readonly deps: {
      input: Input;
      renderer: Renderer;
      hud: Hud;
      levels: readonly LevelData[];
      store: KeyValueStore | null;
      onPlaytest: (data: LevelData) => void;
      onExit: () => void;
    },
  ) {
    this.draft = new LevelDraft(loadDraft(deps.store) ?? undefined);
    this.panel = new EditorPanel(
      {
        onBrush: (brush) => this.edit(() => (this.brush = brush)),
        onTool: (tool) => this.edit(() => (this.tool = tool)),
        onResize: (cols, rows) => this.edit(() => this.draft.resize(cols, rows), true),
        onUndo: () => this.edit(() => this.draft.undo(), true),
        onRedo: () => this.edit(() => this.draft.redo(), true),
        onClear: () => this.edit(() => this.draft.clear(), true),
        onName: (name) => this.edit(() => (this.draft.name = name), true),
        onNumber: (id, value) => this.edit(() => this.draft.setNumber(id, value), true),
        onTemplate: (index) => this.useTemplate(index),
        onPlaytest: () => this.playtest(),
        onExit: () => deps.onExit(),
        exportText: () => this.draft.toSource(),
        onImport: (text) => this.importText(text),
      },
      deps.levels.map((l) => l.name),
    );
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** The grid on screen, for the HUD's tile readout. */
  get grid(): Grid {
    return this.draft.grid;
  }

  enter(): void {
    this.open = true;
    this.panel.show();
    this.showScene();
    this.panel.sync(this.view());
    this.drainInput();
  }

  leave(): void {
    if (!this.open) return;
    this.open = false;
    this.draft.endStroke();
    this.panel.hide();
    this.drainInput();
  }

  update(): void {
    const { input } = this.deps;
    if (this.panel.ioOpen) return this.drainInput(); // the export box has the keyboard
    if (input.consumePress("Escape") || input.consumePress("KeyE")) return this.deps.onExit();
    if (input.consumePress("KeyP")) return this.playtest();

    let changed = false;
    for (const [i, code] of BRUSH_KEYS.entries()) {
      if (input.consumePress(code)) {
        this.brush = BRUSHES[i]!;
        changed = true;
      }
    }
    if (input.consumePress("KeyB")) {
      this.tool = "pencil";
      changed = true;
    }
    if (input.consumePress("KeyF")) {
      this.tool = "fill";
      changed = true;
    }
    let persist = false;
    const undo = input.consumeChord("KeyZ");
    const redo = input.consumeChord("KeyY");
    if (undo) persist = undo.shift ? this.draft.redo() : this.draft.undo();
    else if (redo) persist = this.draft.redo();
    changed ||= persist;

    for (const tile of input.consumeStroke()) {
      changed = true;
      if (tile === null) {
        this.draft.endStroke();
        this.filling = false;
        persist = true;
      } else if (this.tool === "fill") {
        if (!this.filling) this.draft.fill(tile, this.brush);
        this.filling = true;
      } else {
        this.draft.stroke(tile, this.brush);
      }
    }
    input.consumeClicks();
    input.clearPresses(); // keys that mean nothing here shouldn't pile up for the game
    if (changed) this.refresh(persist);
  }

  /** Draw the draft. `time` drives the water and goal animation. */
  render(time: number, showGrid: boolean): void {
    const { input, renderer, hud } = this.deps;
    const tile = input.pointerTile();
    renderer.draw({
      time,
      showGrid,
      hoverTile: tile && this.draft.grid.inBounds(tile.x, tile.y) ? tile : null,
      hoverValid: true,
      hoverLemming: null,
      lemmings: [],
    });
    hud.setHoverTile(this.draft.grid, tile);
  }

  debug(): object {
    return {
      open: this.open,
      brush: this.brush,
      tool: this.tool,
      problems: this.draft.problems(),
      level: this.draft.toLevelData(),
    };
  }

  private view() {
    return {
      draft: this.draft,
      brush: this.brush,
      tool: this.tool,
      warnings: this.draft.warnings(this.deps.levels.map((l) => l.name)),
    };
  }

  /** Run a change, then show it (and save it, if it changed the level rather than just the tools). */
  private edit(change: () => unknown, persist = false): void {
    change();
    this.refresh(persist);
  }

  /** Put the draft's state on screen: a new grid or hatch position for the renderer, and the panel. */
  private refresh(persist: boolean): void {
    if (this.draft.grid !== this.shownGrid) this.showScene();
    else if (this.spawnKey() !== this.shownSpawn) {
      this.deps.renderer.setSpawn(this.draft.spawn);
      this.shownSpawn = this.spawnKey();
    }
    this.panel.sync(this.view());
    if (persist) saveDraft(this.deps.store, this.draft.toLevelData());
  }

  private showScene(): void {
    this.deps.renderer.setLevel(this.draft);
    this.shownGrid = this.draft.grid;
    this.shownSpawn = this.spawnKey();
  }

  private spawnKey(): string {
    const { spawn } = this.draft;
    return spawn ? `${spawn.x},${spawn.y}` : "";
  }

  private playtest(): void {
    if (this.draft.problems().length > 0) return this.panel.sync(this.view()); // the panel lists what's wrong
    this.deps.onPlaytest(this.draft.toLevelData());
  }

  /** Replace the level with a blank map or a copy of a built-in level (after asking). */
  private useTemplate(index: number | null): void {
    if (!confirm("Replace the level in the editor? The map can be undone, but the name and numbers can't.")) return;
    const source = index === null ? new LevelDraft().toLevelData() : this.deps.levels[index]!;
    const data = index === null ? source : { ...source, name: `Copy of ${source.name}` };
    this.edit(() => this.draft.replaceWith(data), true);
  }

  /** Load pasted text. Returns an error message to show, or null on success. */
  private importText(text: string): string | null {
    try {
      this.draft.replaceWith(parseLevelText(text));
    } catch (e) {
      return e instanceof Error ? e.message : "Couldn't read that level.";
    }
    this.refresh(true);
    return null;
  }

  private drainInput(): void {
    const { input } = this.deps;
    input.clearPresses();
    input.consumeStroke();
    input.consumeClicks();
  }
}
