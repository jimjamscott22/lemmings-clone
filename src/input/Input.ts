import { TILE_SIZE } from "../config";
import type { TilePoint } from "../world/Level";

/** A field the player types or picks in; keys aimed at it are for it, not for the game. */
function isTextEntry(target: EventTarget | null): target is HTMLElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Tracks pointer position (in canvas pixel space, compensating for CSS scaling)
 * and keyboard presses. Key presses are queued and consumed once per frame.
 */
export class Input {
  /** Pointer position in canvas pixels, or null when outside the canvas. */
  pointer: { x: number; y: number } | null = null;
  /** Primary button held down over the canvas (captured, so drags may leave it). */
  private pointerDown = false;
  /**
   * Drag samples recorded straight from pointer events, so even a drag that starts and ends
   * between two simulation ticks is seen in full. A tile is a stroke point; null ends a stroke.
   */
  private readonly strokeQueue: Array<TilePoint | null> = [];
  /** Canvas-pixel positions of primary-button presses, for clicking on lemmings. */
  private readonly clickQueue: Array<{ x: number; y: number }> = [];
  private readonly pressed = new Set<string>();
  /** Presses made with Ctrl/Cmd held, by key code, remembering whether Shift was too. */
  private readonly chords = new Map<string, { shift: boolean }>();
  private readonly held = new Set<string>();
  private readonly controller = new AbortController();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const { signal } = this.controller;
    canvas.addEventListener(
      "pointermove",
      (e) => {
        this.updatePointer(e);
        if (this.pointerDown) this.strokeQueue.push(this.pointerTile());
      },
      { signal },
    );
    canvas.addEventListener("pointerleave", () => (this.pointer = null), { signal });
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        // preventDefault keeps the focus where it was; a text field should let go when the canvas is clicked.
        if (isTextEntry(document.activeElement)) document.activeElement.blur();
        canvas.setPointerCapture(e.pointerId);
        this.updatePointer(e);
        this.pointerDown = true;
        this.strokeQueue.push(this.pointerTile());
        if (this.pointer) this.clickQueue.push({ ...this.pointer });
      },
      { signal },
    );
    const release = () => {
      if (this.pointerDown) this.strokeQueue.push(null);
      this.pointerDown = false;
    };
    canvas.addEventListener("pointerup", release, { signal });
    canvas.addEventListener("pointercancel", release, { signal });
    window.addEventListener(
      "keydown",
      (e) => {
        // Native modal keyboard input belongs to its links, buttons, and scrollable content.
        if (e.target instanceof Element && e.target.closest("dialog[open]")) return;
        if (e.repeat || isTextEntry(e.target)) return; // typing in a form field isn't a game key
        if (e.code === "Space") e.preventDefault(); // don't scroll the page
        // The browser's own undo would reach back into a form field edited earlier (and refocus it).
        if ((e.ctrlKey || e.metaKey) && (e.code === "KeyZ" || e.code === "KeyY")) e.preventDefault();
        if (e.ctrlKey || e.metaKey) this.chords.set(e.code, { shift: e.shiftKey });
        else this.pressed.add(e.code);
        this.held.add(e.code);
      },
      { signal },
    );
    window.addEventListener("keyup", (e) => this.held.delete(e.code), { signal });
    // A key released while the window is unfocused never fires keyup.
    window.addEventListener("blur", () => this.held.clear(), { signal });
  }

  /** True once per key press; clears the press. */
  consumePress(code: string): boolean {
    return this.pressed.delete(code);
  }

  /**
   * Once per press of `code` made while Ctrl (or Cmd) was held, tells whether Shift was held too.
   * The modifiers are read when the key goes down, so a quick tap that lets go before the next
   * frame still counts. Ctrl+key presses are never plain presses.
   */
  consumeChord(code: string): { shift: boolean } | null {
    const chord = this.chords.get(code) ?? null;
    this.chords.delete(code);
    return chord;
  }

  /** Forget queued key presses (e.g. ones made while a menu had the keyboard). */
  clearPresses(): void {
    this.pressed.clear();
    this.chords.clear();
  }

  /** True while the key is held down. */
  isDown(code: string): boolean {
    return this.held.has(code);
  }

  /** Drains the drag samples recorded since the last call (null = stroke ended). */
  consumeStroke(): Array<TilePoint | null> {
    return this.strokeQueue.splice(0);
  }

  /** Drains the click positions recorded since the last call. */
  consumeClicks(): Array<{ x: number; y: number }> {
    return this.clickQueue.splice(0);
  }

  /** Grid tile under the pointer, or null. */
  pointerTile(): TilePoint | null {
    if (!this.pointer) return null;
    return { x: Math.floor(this.pointer.x / TILE_SIZE), y: Math.floor(this.pointer.y / TILE_SIZE) };
  }

  dispose(): void {
    this.controller.abort();
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = {
      x: ((e.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }
}
