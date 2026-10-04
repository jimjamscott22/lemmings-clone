import type { KeyValueStore } from "../progress/Progress";
import { parseMap, type LevelData } from "../world/Level";
import { coerceLevelData } from "./levelText";

export const DRAFT_KEY = "lemmings-clone:editor-draft";

/** The level being edited, if one was saved and is still readable. Never throws. */
export function loadDraft(store: KeyValueStore | null): LevelData | null {
  try {
    const raw = store?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = coerceLevelData(JSON.parse(raw));
    parseMap(data); // a draft that no longer parses is as good as none
    return data;
  } catch {
    return null;
  }
}

/** Remember the level being edited. A full or blocked store is ignored: the draft stays in memory. */
export function saveDraft(store: KeyValueStore | null, data: LevelData): void {
  try {
    store?.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
