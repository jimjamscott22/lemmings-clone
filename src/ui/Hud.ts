import { TILE_SWATCH } from "../render/palette";
import type { Grid } from "../world/Grid";
import type { TilePoint } from "../world/Level";
import { TILE_PROPS, TileType } from "../world/TileType";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

/** DOM overlay (Tailwind-styled). Writes to the DOM only when values change. */
export class Hud {
  private readonly levelEl = byId("hud-level");
  private readonly tileEl = byId("hud-tile");
  private readonly fpsEl = byId("hud-fps");
  private readonly pausedEl = byId("hud-paused");
  private readonly legendEl = byId<HTMLUListElement>("hud-legend");

  private lastFpsUpdate = 0;
  private lastTileText = "";

  constructor() {
    this.buildLegend();
  }

  setLevelName(name: string): void {
    this.levelEl.textContent = name;
  }

  setPaused(paused: boolean): void {
    this.pausedEl.classList.toggle("hidden", !paused);
  }

  setHoverTile(grid: Grid, tile: TilePoint | null): void {
    const text =
      tile && grid.inBounds(tile.x, tile.y) ? `${TILE_PROPS[grid.get(tile.x, tile.y)].name} (${tile.x}, ${tile.y})` : "—";
    if (text !== this.lastTileText) {
      this.tileEl.textContent = text;
      this.lastTileText = text;
    }
  }

  /** Throttled to ~4 updates/second so the number is readable. */
  setFps(fps: number, now: number): void {
    if (now - this.lastFpsUpdate < 250) return;
    this.lastFpsUpdate = now;
    this.fpsEl.textContent = Math.round(fps).toString();
  }

  private buildLegend(): void {
    const items = Object.values(TileType)
      .filter((t) => t !== TileType.Empty)
      .map((t) => {
        const li = document.createElement("li");
        li.className = "flex items-center gap-1.5";
        const swatch = document.createElement("span");
        swatch.className = "inline-block size-3 rounded-sm ring-1 ring-white/20";
        swatch.style.backgroundColor = TILE_SWATCH[t];
        li.append(swatch, TILE_PROPS[t].name);
        return li;
      });
    this.legendEl.replaceChildren(...items);
  }
}
