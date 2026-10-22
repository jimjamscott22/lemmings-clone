import type { KeyValueStore } from "../progress/Progress";
import type { LevelData } from "../world/Level";
import { LevelDraft } from "./LevelDraft";
import { coerceLevelData } from "./levelText";

export const DRAFT_KEY = "lemmings-clone:editor-draft";

/** The level being edited, if one was saved and is still readable. Never throws. */
export function loadDraft(store: KeyValueStore | null): LevelData | null {
  try {
    const raw = store?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = coerceLevelData(JSON.parse(raw));
    new LevelDraft(data); // discard drafts that no longer parse or exceed the editor's limits
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
