import type { Lemming } from "../entities/Lemming";
import type { World } from "../entities/World";
import { SKILLS, type Skill } from "../skills/skills";
import type { Level, TilePoint } from "../world/Level";
import { ACTION_ORDER, isSkill, type ActionId } from "./actions";
import { TOOLS } from "./tools";

/**
 * The player's tool belt: which action is selected and how many charges each has left.
 * Terrain tools are applied with a click-and-drag stroke that edits every tile the pointer passes
 * over, filling gaps between samples so fast drags don't skip tiles. Skills are given to one
 * lemming at a time with `assign`.
 */
export class Toolbox {
  selected: ActionId = "dig";
  readonly charges: Record<ActionId, number>;
  private lastTile: TilePoint | null = null;

  constructor(private readonly level: Level) {
    const { tools, skills } = level.data;
    this.charges = Object.fromEntries(
      ACTION_ORDER.map((id) => [id, (isSkill(id) ? skills?.[id] : tools?.[id]) ?? 0]),
    ) as Record<ActionId, number>;
  }

  select(id: ActionId): void {
    this.selected = id;
    this.endStroke();
  }

  /** The selected skill, or null while a terrain tool is selected. */
  get selectedSkill(): Skill | null {
    return isSkill(this.selected) ? SKILLS[this.selected] : null;
  }

  /** Whether the selected terrain tool could be used on this tile right now. */
  canUseAt(tile: TilePoint): boolean {
    const id = this.selected;
    if (isSkill(id)) return false;
    return this.charges[id] > 0 && TOOLS[id].canApply(this.level.grid, tile.x, tile.y, this.level.spawn);
  }

  /** Continue (or start) a stroke at `tile`. Returns how many tiles were changed. */
  stroke(tile: TilePoint): number {
    const id = this.selected;
    if (isSkill(id)) return 0;
    const from = this.lastTile ?? tile;
    this.lastTile = tile;
    let changed = 0;
    for (const t of tilesOnLine(from, tile)) {
      if (!this.canUseAt(t)) continue;
      TOOLS[id].apply(this.level.grid, t.x, t.y);
      this.charges[id]--;
      changed++;
    }
    return changed;
  }

  endStroke(): void {
    this.lastTile = null;
  }

  /** Whether the selected skill could be given to this lemming right now. */
  canAssign(lemming: Lemming): boolean {
    const skill = this.selectedSkill;
    return skill !== null && this.charges[skill.id] > 0 && skill.canAssign(lemming);
  }

  /** Give the selected skill to a lemming, spending a charge. Returns false if it can't take it. */
  assign(lemming: Lemming, world: World): boolean {
    const skill = this.selectedSkill;
    if (!skill || !this.canAssign(lemming)) return false;
    skill.assign(lemming, world);
    this.charges[skill.id]--;
    return true;
  }
}

/** Grid cells on the line from a to b inclusive (Bresenham). */
export function tilesOnLine(a: TilePoint, b: TilePoint): TilePoint[] {
  const out: TilePoint[] = [];
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  let { x, y } = a;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
