import "./style.css";
import { Game } from "./core/Game";
import { Progress, type KeyValueStore } from "./progress/Progress";
import { LEVELS } from "./world/levels";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const viewport = document.getElementById("viewport")!;

/** localStorage, or null if the browser blocks it (e.g. some private modes), so progress stays in memory. */
function browserStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const progress = new Progress(browserStorage());
const game = new Game(canvas, viewport, LEVELS, progress);
game.loadLevel(progress.resumeIndex(LEVELS.map((l) => l.name)));
game.start();

// Dev-only handle for poking at state from the browser console.
if (import.meta.env.DEV) Object.assign(window, { game, progress });
