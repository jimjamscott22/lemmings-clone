import "./style.css";
import { Game } from "./core/Game";
import { LEVELS } from "./world/levels";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const viewport = document.getElementById("viewport")!;

const game = new Game(canvas, viewport);
game.loadLevel(LEVELS[0]!);
game.start();

// Dev-only handle for poking at state from the browser console.
if (import.meta.env.DEV) Object.assign(window, { game });
