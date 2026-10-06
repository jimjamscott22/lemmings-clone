import { NUKE_CONFIRM_TIME } from "../config";

/**
 * The nuke can't be undone, so it takes two presses: the first arms it, and a second within
 * NUKE_CONFIRM_TIME seconds fires it. Time is real time (fed from `update`), so it also runs while paused.
 */
export class NukeSwitch {
  private remaining = 0;

  get armed(): boolean {
    return this.remaining > 0;
  }

  /** Returns true if this press confirms an armed switch; otherwise arms it. */
  press(): boolean {
    if (this.armed) {
      this.remaining = 0;
      return true;
    }
    this.remaining = NUKE_CONFIRM_TIME;
    return false;
  }

  update(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt);
  }
}
