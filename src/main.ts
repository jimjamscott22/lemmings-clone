import "./style.css";
import { Game } from "./core/Game";
import { levelFromHash } from "./editor/levelShare";
import { Progress, type KeyValueStore } from "./progress/Progress";
import type { LevelData } from "./world/Level";
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

const store = browserStorage();
const progress = new Progress(store);
const game = new Game(canvas, viewport, LEVELS, progress, store);

/**
 * The level in the address's `#level=` link, if any. The hash is cleared either way, so a reload
 * doesn't replay it and the address bar goes back to the plain game. A bad link tells the player so.
 */
function takeSharedLevel(): LevelData | null {
  const { hash } = window.location;
  if (!hash.startsWith("#level=")) return null;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  try {
    return levelFromHash(hash);
  } catch (e) {
    alert(e instanceof Error ? e.message : "That level link couldn't be read.");
    return null;
  }
}

game.loadLevel(progress.resumeIndex(LEVELS.map((l) => l.name)));
const shared = takeSharedLevel();
if (shared) game.playShared(shared);
else game.openLevelSelect();
game.start();

// A link pasted into a tab that already has the game open only changes the hash.
window.addEventListener("hashchange", () => {
  const level = takeSharedLevel();
  if (level) game.playShared(level);
});

// Dev-only handle for poking at state from the browser console.
if (import.meta.env.DEV) Object.assign(window, { game, progress, render_game_to_text: () => JSON.stringify(game.debug()) });
