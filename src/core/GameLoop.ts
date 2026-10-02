import { FIXED_TIMESTEP, MAX_FRAME_TIME } from "../config";

export interface LoopCallbacks {
  /** Advance the simulation by exactly `dt` seconds. Called 0..N times per frame. */
  update(dt: number): void;
  /** Draw the current state. `alpha` ∈ [0,1) is how far we are into the next fixed step (for interpolation). */
  render(alpha: number): void;
}

/**
 * Fixed-timestep loop on top of requestAnimationFrame ("Fix Your Timestep" pattern).
 * Simulation runs at a constant rate; rendering runs at display rate.
 */
export class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;

  /** Smoothed frames-per-second, for the HUD. */
  fps = 0;

  constructor(
    private readonly callbacks: LoopCallbacks,
    private readonly step = FIXED_TIMESTEP,
  ) {}

  get running(): boolean {
    return this.rafId !== null;
  }

  start(): void {
    if (this.running) return;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private readonly frame = (now: number): void => {
    const frameTime = Math.min((now - this.lastTime) / 1000, MAX_FRAME_TIME);
    this.lastTime = now;

    if (frameTime > 0) this.fps += (1 / frameTime - this.fps) * 0.05;

    this.accumulator += frameTime;
    while (this.accumulator >= this.step) {
      this.callbacks.update(this.step);
      this.accumulator -= this.step;
    }
    this.callbacks.render(this.accumulator / this.step);

    this.rafId = requestAnimationFrame(this.frame);
  };
}
