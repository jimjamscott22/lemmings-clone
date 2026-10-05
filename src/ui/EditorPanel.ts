import { BRUSHES, brushName, DRAFT_FIELDS, GRID_LIMITS, type Brush, type FieldId, type LevelDraft } from "../editor/LevelDraft";
import { PALETTE, TILE_SWATCH } from "../render/palette";
import { byId } from "./Hud";

export type PaintTool = "pencil" | "fill";

/** Key codes for picking a brush: 1 selects the first, and so on. */
export const BRUSH_KEYS = BRUSHES.map((_, i) => `Digit${i + 1}`);

export interface EditorHandlers {
  onBrush: (brush: Brush) => void;
  onTool: (tool: PaintTool) => void;
  onResize: (cols: number, rows: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onName: (name: string) => void;
  onNumber: (id: FieldId, value: number) => void;
  /** Start from a built-in level (its index), or from a blank map (null). */
  onTemplate: (index: number | null) => void;
  onPlaytest: () => void;
  onExit: () => void;
  /** Source text for the export box. */
  exportText: () => string;
  /** A link that opens the level in anyone's game. */
  shareLink: () => string;
  /** Load pasted text into the editor. Returns an error message, or null on success. */
  onImport: (text: string) => string | null;
}

export interface EditorView {
  draft: LevelDraft;
  brush: Brush;
  tool: PaintTool;
  warnings: readonly string[];
}

const INPUT_CLASS =
  "rounded border border-stone-700 bg-stone-900 px-1 py-0.5 text-stone-100 tabular-nums focus-visible:outline-2 focus-visible:outline-lime-400";
const BUTTON_CLASS =
  "rounded border border-stone-700 bg-stone-900 px-2 py-1 font-pixel text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-stone-900";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}

function kbd(text: string): HTMLElement {
  return el("kbd", "kbd", text);
}

/**
 * The level editor's controls under the canvas: brushes, size, history, the level's name and
 * numbers, and the playtest / export buttons. The panel only reflects a `LevelDraft`; every
 * change is handed back through the handlers and shown again by `sync`.
 */
export class EditorPanel {
  private readonly root = byId("editor");
  private readonly io = byId("editor-io");
  private readonly ioText = byId<HTMLTextAreaElement>("editor-io-text");
  private readonly ioStatus = byId("editor-io-status");

  private readonly brushButtons = new Map<Brush, HTMLButtonElement>();
  private readonly toolButtons = new Map<PaintTool, HTMLButtonElement>();
  private readonly colsInput = el("input", `${INPUT_CLASS} w-14`);
  private readonly rowsInput = el("input", `${INPUT_CLASS} w-14`);
  private readonly nameInput = el("input", `${INPUT_CLASS} w-44`);
  private readonly numberInputs = new Map<FieldId, HTMLInputElement>();
  private readonly undoButton = el("button", BUTTON_CLASS, "Undo");
  private readonly redoButton = el("button", BUTTON_CLASS, "Redo");
  private readonly templates = el("select", `${INPUT_CLASS} w-40`);
  private readonly playtestButton = el("button", `${BUTTON_CLASS} border-lime-500 text-lime-200 hover:bg-lime-600/30`);
  private readonly shareButton = el("button", BUTTON_CLASS, "Share");
  private shareLabelTimer = 0;
  private readonly problemsEl = el("ul", "flex flex-wrap gap-x-4 gap-y-0.5");
  /** The number field just committed: shown again with its clamped value even while it has focus. */
  private edited: HTMLInputElement | null = null;

  constructor(
    private readonly handlers: EditorHandlers,
    templateNames: readonly string[],
  ) {
    this.root.replaceChildren(
      this.buildPaintRow(),
      this.buildLevelRow(),
      this.buildActionRow(templateNames),
    );
    this.buildIo();
    // A field is let go with Esc, so the shortcut keys work again without reaching for the mouse.
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target instanceof HTMLElement && e.target !== this.root) e.target.blur();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  show(): void {
    this.root.classList.replace("hidden", "flex");
  }

  hide(): void {
    this.closeIo();
    this.root.classList.replace("flex", "hidden");
  }

  /** Bring every control in line with the draft. Fields being typed in are left alone. */
  sync({ draft, brush, tool, warnings }: EditorView): void {
    for (const [b, button] of this.brushButtons) setActive(button, b === brush);
    for (const [t, button] of this.toolButtons) setActive(button, t === tool);
    const show = (input: HTMLInputElement, value: number) => {
      if (input === this.edited || document.activeElement !== input) input.value = String(value);
    };
    show(this.colsInput, draft.grid.cols);
    show(this.rowsInput, draft.grid.rows);
    if (document.activeElement !== this.nameInput) this.nameInput.value = draft.name;
    for (const [id, input] of this.numberInputs) show(input, draft.getNumber(id));
    this.edited = null;
    this.undoButton.disabled = !draft.canUndo;
    this.redoButton.disabled = !draft.canRedo;

    const problems = draft.problems();
    this.playtestButton.disabled = problems.length > 0;
    this.shareButton.disabled = problems.length > 0;
    this.shareButton.title = problems.length ? "Fix the problems first" : "Copy a link that opens this level in anyone's game";
    this.playtestButton.title = problems.length ? "Fix the problems first" : "Try the level out (P)";
    const items = [
      ...problems.map((p) => ({ text: p, tone: "text-red-300" })),
      ...warnings.map((w) => ({ text: w, tone: "text-amber-300" })),
    ];
    this.problemsEl.replaceChildren(
      ...(items.length
        ? items.map(({ text, tone }) => el("li", tone, text))
        : [el("li", "text-lime-300", "Ready to playtest.")]),
    );
  }

  /* Export / import */

  get ioOpen(): boolean {
    return !this.io.classList.contains("hidden");
  }

  /** Show the export box, with `text` in it (the level's source unless told otherwise). */
  openIo(text = this.handlers.exportText(), status = ""): void {
    this.ioText.value = text;
    this.ioStatus.textContent = status;
    this.io.classList.replace("hidden", "flex");
    this.ioText.focus();
    this.ioText.select();
  }

  closeIo(): void {
    this.io.classList.replace("flex", "hidden");
  }

  private buildIo(): void {
    byId("editor-io-close").addEventListener("click", () => this.closeIo());
    byId("editor-io-copy").addEventListener("click", async () => {
      this.ioText.value = this.handlers.exportText();
      try {
        await navigator.clipboard.writeText(this.ioText.value);
        this.ioStatus.textContent = "Copied. Paste it into the LEVELS array in src/world/levels.ts.";
      } catch {
        this.ioText.select();
        this.ioStatus.textContent = "Couldn't reach the clipboard: the text is selected, press Ctrl+C.";
      }
    });
    byId("editor-io-load").addEventListener("click", () => {
      const error = this.handlers.onImport(this.ioText.value);
      if (error) {
        this.ioStatus.textContent = error;
      } else {
        this.closeIo();
      }
    });
    this.io.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // closes the box only; the same press must not also leave the editor
      this.closeIo();
    });
  }

  /** Copy the share link; if the clipboard is out of reach, show it for the player to copy by hand. */
  private async share(): Promise<void> {
    const link = this.handlers.shareLink();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      this.openIo(link, "Couldn't reach the clipboard: this is the link, press Ctrl+C.");
      return;
    }
    this.shareButton.textContent = "Link copied!";
    clearTimeout(this.shareLabelTimer);
    this.shareLabelTimer = window.setTimeout(() => (this.shareButton.textContent = "Share"), 1800);
  }

  /* Layout */

  private buildPaintRow(): HTMLElement {
    const row = el("div", "flex flex-wrap items-center gap-x-4 gap-y-2");

    const brushes = el("div", "flex flex-wrap gap-1.5");
    for (const [i, brush] of BRUSHES.entries()) {
      const button = el("button", `${BUTTON_CLASS} flex items-center gap-1.5`);
      button.type = "button";
      button.title = `Paint ${brushName(brush)}`;
      const swatch = el("span", "inline-block size-3 rounded-sm ring-1 ring-white/20");
      swatch.style.backgroundColor = brush === "spawn" ? PALETTE.wallDark : TILE_SWATCH[brush];
      if (brush === "spawn") swatch.append(el("span", "block text-center text-[8px] leading-3 text-stone-100", "S"));
      button.append(kbd(String(i + 1)), swatch, brushName(brush));
      button.addEventListener("click", () => this.handlers.onBrush(brush));
      this.brushButtons.set(brush, button);
      brushes.append(button);
    }

    const tools = el("div", "flex gap-1.5");
    for (const [tool, name, key, hint] of [
      ["pencil", "Pencil", "B", "Drag to paint tiles"],
      ["fill", "Fill", "F", "Click to fill a connected area"],
    ] as const) {
      const button = el("button", `${BUTTON_CLASS} flex items-center gap-1.5`);
      button.type = "button";
      button.title = hint;
      button.append(kbd(key), name);
      button.addEventListener("click", () => this.handlers.onTool(tool));
      this.toolButtons.set(tool, button);
      tools.append(button);
    }

    const size = el("label", "flex items-center gap-1.5 font-pixel text-stone-300", "Size");
    size.title = "Map size in tiles; shrinking crops from the right and bottom";
    for (const [input, min, max] of [
      [this.colsInput, GRID_LIMITS.minCols, GRID_LIMITS.maxCols],
      [this.rowsInput, GRID_LIMITS.minRows, GRID_LIMITS.maxRows],
    ] as const) {
      Object.assign(input, { type: "number", min, max, step: 1 });
      input.addEventListener("change", () => {
        this.edited = input;
        this.handlers.onResize(Number(this.colsInput.value), Number(this.rowsInput.value));
      });
    }
    size.append(this.colsInput, "×", this.rowsInput);

    for (const [button, handler] of [
      [this.undoButton, this.handlers.onUndo],
      [this.redoButton, this.handlers.onRedo],
    ] as const) {
      button.type = "button";
      button.addEventListener("click", handler);
    }
    this.undoButton.title = "Undo the last map change (Ctrl+Z)";
    this.redoButton.title = "Redo (Ctrl+Y)";
    const clear = el("button", BUTTON_CLASS, "Clear");
    clear.type = "button";
    clear.title = "Empty the whole map (can be undone)";
    clear.addEventListener("click", this.handlers.onClear);

    const history = el("div", "flex gap-1.5");
    history.append(this.undoButton, this.redoButton, clear);
    row.append(brushes, tools, size, history);
    return row;
  }

  private buildLevelRow(): HTMLElement {
    const row = el("div", "flex flex-wrap items-center gap-x-4 gap-y-2");

    const name = el("label", "flex items-center gap-1.5 font-pixel text-stone-300", "Name");
    Object.assign(this.nameInput, { type: "text", maxLength: 40 });
    this.nameInput.addEventListener("input", () => this.handlers.onName(this.nameInput.value));
    name.append(this.nameInput);
    row.append(name);

    for (const field of DRAFT_FIELDS) {
      const label = el("label", "flex items-center gap-1.5 font-pixel text-stone-300", field.label);
      label.title = field.hint;
      const input = el("input", `${INPUT_CLASS} w-14`);
      Object.assign(input, { type: "number", min: field.min, max: field.max, step: 1 });
      input.addEventListener("change", () => {
        this.edited = input;
        this.handlers.onNumber(field.id, Number(input.value));
      });
      this.numberInputs.set(field.id, input);
      label.append(input);
      row.append(label);
    }
    return row;
  }

  private buildActionRow(templateNames: readonly string[]): HTMLElement {
    const row = el("div", "flex flex-wrap items-center justify-between gap-x-6 gap-y-2");
    row.append(this.problemsEl);

    const select = this.templates;
    select.title = "Replace the editor's level with a blank map or a copy of a built-in level";
    select.append(
      new Option("Start from…", ""),
      new Option("Blank map", "blank"),
      ...templateNames.map((n, i) => new Option(`${i + 1}. ${n}`, String(i))),
    );
    select.addEventListener("change", () => {
      const { value } = select;
      select.value = "";
      if (value) this.handlers.onTemplate(value === "blank" ? null : Number(value));
    });

    this.shareButton.type = "button";
    this.shareButton.addEventListener("click", () => void this.share());

    const exportButton = el("button", BUTTON_CLASS, "Export / import");
    exportButton.type = "button";
    exportButton.title = "Copy the level as code for levels.ts, or load one back in";
    exportButton.addEventListener("click", () => this.openIo());

    this.playtestButton.type = "button";
    this.playtestButton.replaceChildren(kbd("P"), " Playtest");
    this.playtestButton.addEventListener("click", this.handlers.onPlaytest);

    const back = el("button", BUTTON_CLASS);
    back.type = "button";
    back.append(kbd("E"), " Back to game");
    back.addEventListener("click", this.handlers.onExit);

    const actions = el("div", "flex flex-wrap items-center gap-1.5");
    actions.append(select, this.shareButton, exportButton, this.playtestButton, back);
    row.append(actions);
    return row;
  }
}

function setActive(button: HTMLButtonElement, active: boolean): void {
  button.classList.toggle("border-lime-400", active);
  button.classList.toggle("text-lime-200", active);
  button.classList.toggle("border-stone-700", !active);
  button.setAttribute("aria-pressed", String(active));
}
