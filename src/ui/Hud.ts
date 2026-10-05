import { TILE_SWATCH } from "../render/palette";
import type { Grid } from "../world/Grid";
import type { TilePoint } from "../world/Level";
import { TILE_PROPS, TileType } from "../world/TileType";
import { ACTION_ORDER, actionInfo, isSkill, type ActionId } from "../tools/actions";

/** Simulated seconds as m:ss. */
export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

/** What the player is doing: playing the game, building a level, or trying their level out. */
export type HudMode = "play" | "edit" | "playtest";

/** Show or hide an element that is `flex` when visible. */
function setFlexVisible(el: HTMLElement, visible: boolean): void {
  if (visible) el.classList.replace("hidden", "flex");
  else el.classList.replace("flex", "hidden");
}

/** DOM overlay (Tailwind-styled). Writes to the DOM only when values change. */
export class Hud {
  private readonly levelEl = byId("hud-level");
  private readonly progressEl = byId("hud-progress");
  private readonly bestEl = byId("hud-best");
  private readonly tileEl = byId("hud-tile");
  private readonly fpsEl = byId("hud-fps");
  private readonly pausedEl = byId("hud-paused");
  private readonly fastEl = byId("hud-fast");
  private readonly modeEl = byId("hud-mode");
  private readonly playStatsEl = byId("hud-play-stats");
  private readonly footerEl = byId("play-footer");
  private readonly statEls = {
    out: byId("hud-out"),
    saved: byId("hud-saved"),
    need: byId("hud-need"),
    lost: byId("hud-lost"),
  };
  private lastStatsKey = "";
  private readonly legendEl = byId<HTMLUListElement>("hud-legend");
  private readonly toolsEl = byId("hud-tools");
  private readonly toolButtons = new Map<ActionId, { button: HTMLButtonElement; count: HTMLElement }>();
  private lastToolsKey = "";
  private readonly rateEl = byId("hud-rate");
  private lastRate = -1;

  private lastFpsUpdate = 0;
  private lastTileText = "";

  constructor(handlers: {
    onSelectTool: (id: ActionId) => void;
    onAdjustRate: (delta: number) => void;
    onOpenLevels: () => void;
    onOpenEditor: () => void;
  }) {
    this.buildLegend();
    this.buildToolbar(handlers.onSelectTool);
    byId("hud-levels").addEventListener("click", handlers.onOpenLevels);
    byId("hud-editor").addEventListener("click", handlers.onOpenEditor);
    byId("hud-rate-down").addEventListener("click", () => handlers.onAdjustRate(-1));
    byId("hud-rate-up").addEventListener("click", () => handlers.onAdjustRate(1));
  }

  /** The level editor replaces the play controls and stats; a playtest keeps them under a banner. */
  setMode(mode: HudMode): void {
    setFlexVisible(this.playStatsEl, mode !== "edit");
    setFlexVisible(this.footerEl, mode !== "edit");
    this.modeEl.textContent = mode === "edit" ? "EDITOR" : mode === "playtest" ? "PLAYTEST" : "";
    this.modeEl.classList.toggle("hidden", mode === "play");
  }

  setReleaseRate(rate: number): void {
    if (rate === this.lastRate) return;
    this.lastRate = rate;
    this.rateEl.textContent = String(rate);
  }

  /** Highlights the selected tool or skill and shows remaining charges. */
  setTools(selected: ActionId, charges: Readonly<Record<ActionId, number>>): void {
    const key = `${selected}|${ACTION_ORDER.map((id) => charges[id]).join(",")}`;
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

  setSolved(solved: number, total: number): void {
    this.progressEl.textContent = `Solved ${solved}/${total}`;
  }

  /** Personal best on the current level, or a dash if it has never been finished. */
  setBest(best: { saved: number; total: number; fastestWin: number | null } | null): void {
    if (!best) {
      this.bestEl.textContent = "Best —";
      return;
    }
    const time = best.fastestWin === null ? "" : ` · ${formatTime(best.fastestWin)}`;
    this.bestEl.textContent = `Best ${best.saved}/${best.total}${time}`;
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

  /** One button per tool and skill, with a divider between the two groups. */
  private buildToolbar(onSelect: (id: ActionId) => void): void {
    const children: HTMLElement[] = [];
    for (const [i, id] of ACTION_ORDER.entries()) {
      if (i > 0 && isSkill(id) && !isSkill(ACTION_ORDER[i - 1]!)) {
        const divider = document.createElement("span");
        divider.className = "mx-1 w-px self-stretch bg-stone-700";
        children.push(divider);
      }
      const { name, hint } = actionInfo(id);
      const button = document.createElement("button");
      button.type = "button";
      button.title = hint;
      button.className =
        "flex items-center gap-1.5 rounded border border-stone-700 bg-stone-900 px-2 py-1 font-pixel text-stone-300 hover:bg-stone-800";
      const count = document.createElement("span");
      count.className = "tabular-nums text-stone-100";
      const key = document.createElement("kbd");
      key.className = "kbd";
      key.textContent = String(i + 1);
      button.append(key, name, count);
      button.addEventListener("click", () => onSelect(id));
      this.toolButtons.set(id, { button, count });
      children.push(button);
    }
    this.toolsEl.replaceChildren(...children);
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
