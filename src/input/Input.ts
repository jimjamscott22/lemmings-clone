import { TILE_SIZE } from "../config";
import type { TilePoint } from "../world/Level";

/**
 * Tracks pointer position (in canvas pixel space, compensating for CSS scaling)
 * and keyboard presses. Key presses are queued and consumed once per frame.
 */
export class Input {
  /** Pointer position in canvas pixels, or null when outside the canvas. */
  pointer: { x: number; y: number } | null = null;
  private readonly pressed = new Set<string>();
  private readonly controller = new AbortController();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const { signal } = this.controller;
    canvas.addEventListener("pointermove", (e) => this.updatePointer(e), { signal });
    canvas.addEventListener("pointerleave", () => (this.pointer = null), { signal });
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.repeat) return;
        if (e.code === "Space") e.preventDefault(); // don't scroll the page
        this.pressed.add(e.code);
      },
      { signal },
    );
  }

  /** True once per key press; clears the press. */
  consumePress(code: string): boolean {
    return this.pressed.delete(code);
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
