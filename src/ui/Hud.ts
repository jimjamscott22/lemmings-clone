import { TILE_SWATCH } from "../render/palette";
import type { Grid } from "../world/Grid";
import type { TilePoint } from "../world/Level";
import { TILE_PROPS, TileType } from "../world/TileType";
import { TOOL_ORDER, TOOLS, type ToolId } from "../tools/tools";

export function byId<T extends HTMLElement>(id: string): T {
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
  private readonly fastEl = byId("hud-fast");
  private readonly statEls = {
    out: byId("hud-out"),
    saved: byId("hud-saved"),
    need: byId("hud-need"),
    lost: byId("hud-lost"),
  };
  private lastStatsKey = "";
  private readonly legendEl = byId<HTMLUListElement>("hud-legend");
  private readonly toolsEl = byId("hud-tools");
  private readonly toolButtons = new Map<ToolId, { button: HTMLButtonElement; count: HTMLElement }>();
  private lastToolsKey = "";

  private lastFpsUpdate = 0;
  private lastTileText = "";

  constructor(onSelectTool: (id: ToolId) => void) {
    this.buildLegend();
    this.buildToolbar(onSelectTool);
  }

  /** Highlights the selected tool and shows remaining charges. */
  setTools(selected: ToolId, charges: Readonly<Record<ToolId, number>>): void {
    const key = `${selected}|${TOOL_ORDER.map((id) => charges[id]).join(",")}`;
    if (key === this.lastToolsKey) return;
    this.lastToolsKey = key;
    for (const [id, { button, count }] of this.toolButtons) {
      const active = id === selected;
      button.classList.toggle("border-lime-400", active);
      button.classList.toggle("text-lime-200", active);
      button.classList.toggle("border-stone-700", !active);
      button.setAttribute("aria-pressed", String(active));
      count.textContent = String(charges[id]);
      button.classList.toggle("opacity-50", charges[id] === 0);
    }
  }

  setLevelName(name: string): void {
    this.levelEl.textContent = name;
  }

  setPaused(paused: boolean): void {
    this.pausedEl.classList.toggle("hidden", !paused);
  }

  setFast(fast: boolean): void {
    this.fastEl.classList.toggle("hidden", !fast);
  }

  setStats(stats: { out: number; saved: number; need: number; lost: number }): void {
    const key = `${stats.out},${stats.saved},${stats.need},${stats.lost}`;
    if (key === this.lastStatsKey) return;
    this.lastStatsKey = key;
    for (const k of ["out", "saved", "need", "lost"] as const) this.statEls[k].textContent = String(stats[k]);
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

  private buildToolbar(onSelect: (id: ToolId) => void): void {
    for (const [i, id] of TOOL_ORDER.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "flex items-center gap-2 rounded border border-stone-700 bg-stone-900 px-2.5 py-1 font-pixel text-stone-300 hover:bg-stone-800";
      const count = document.createElement("span");
      count.className = "tabular-nums text-stone-100";
      const hint = document.createElement("kbd");
      hint.className = "kbd";
      hint.textContent = String(i + 1);
      button.append(hint, TOOLS[id].name, count);
      button.addEventListener("click", () => onSelect(id));
      this.toolButtons.set(id, { button, count });
    }
    this.toolsEl.replaceChildren(...[...this.toolButtons.values()].map((b) => b.button));
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
