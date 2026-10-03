/** The subset of the Web Storage API that progress needs; `localStorage` satisfies it. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What's remembered about one level. */
export interface LevelRecord {
  /** Attempts that ran to the end (restarts part-way through don't count). */
  attempts: number;
  wins: number;
  /** Most lemmings saved in any finished attempt, won or lost. */
  bestSaved: number;
  /** Fewest simulated seconds to win, or null if never won. */
  fastestWin: number | null;
  /** When the level was first won (ISO 8601), or null. */
  firstWonAt: string | null;
}

export interface Settings {
  showGrid: boolean;
}

/** The outcome of a finished attempt, as recorded. */
export interface AttemptResult {
  won: boolean;
  saved: number;
  /** Simulated seconds from the start of the level to the end of the attempt. */
  time: number;
}

/** What changed when an attempt was recorded, for "New best!" messages. */
export interface RecordUpdate {
  record: LevelRecord;
  firstWin: boolean;
  newBestSaved: boolean;
  newFastestWin: boolean;
}

interface SaveData {
  version: typeof VERSION;
  /** Keyed by level name, so reordering or inserting levels keeps existing records. */
  levels: Record<string, LevelRecord>;
  /** Name of the level played most recently, to resume there. */
  lastLevel: string | null;
  settings: Settings;
}

export const STORAGE_KEY = "lemmings-clone:progress";
const VERSION = 1;

const emptyRecord = (): LevelRecord => ({ attempts: 0, wins: 0, bestSaved: 0, fastestWin: null, firstWonAt: null });
const emptyData = (): SaveData => ({ version: VERSION, levels: {}, lastLevel: null, settings: { showGrid: false } });

/**
 * Persistent player progress: which levels are solved, personal bests, the level to resume,
 * and settings. Every change is written through to the store immediately.
 *
 * DOM-free: pass `localStorage` in the browser, a fake in tests, or null to keep progress in
 * memory only (e.g. when storage is blocked). Storage errors and corrupt or unknown save data
 * never throw; they fall back to a fresh start.
 */
export class Progress {
  private data: SaveData;

  constructor(
    private readonly store: KeyValueStore | null,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.data = this.load();
  }

  /** The record for a level; all zeros if it has never been finished. */
  get(levelName: string): LevelRecord {
    return { ...(this.data.levels[levelName] ?? emptyRecord()) };
  }

  isSolved(levelName: string): boolean {
    return (this.data.levels[levelName]?.wins ?? 0) > 0;
  }

  /**
   * Levels unlock in order: the first is always open, and each later one opens once the one
   * before it is solved. A level already solved stays open even if levels are reordered.
   */
  isUnlocked(levelNames: readonly string[], index: number): boolean {
    const name = levelNames[index];
    if (name === undefined) return false;
    return index === 0 || this.isSolved(name) || this.isSolved(levelNames[index - 1]!);
  }

  /** How many of the given levels have been won at least once. */
  solvedCount(levelNames: readonly string[]): number {
    return levelNames.filter((name) => this.isSolved(name)).length;
  }

  /** Record a finished attempt and save. */
  record(levelName: string, result: AttemptResult): RecordUpdate {
    // Accumulated fixed steps drift (48.5999…); keep stored times tidy.
    const time = Math.round(result.time * 100) / 100;
    const prev = this.get(levelName);
    const rec: LevelRecord = { ...prev, attempts: prev.attempts + 1 };
    const newBestSaved = result.saved > prev.bestSaved;
    if (newBestSaved) rec.bestSaved = result.saved;

    let newFastestWin = false;
    if (result.won) {
      rec.wins++;
      rec.firstWonAt ??= this.now().toISOString();
      // Only a beaten time counts as new; the very first win is reported as firstWin instead.
      newFastestWin = prev.fastestWin !== null && time < prev.fastestWin;
      if (prev.fastestWin === null || newFastestWin) rec.fastestWin = time;
    }

    this.data.levels[levelName] = rec;
    this.save();
    return { record: { ...rec }, firstWin: result.won && prev.wins === 0, newBestSaved, newFastestWin };
  }

  /** Index to start at: the level last played (if still unlocked), or else the first unsolved one. */
  resumeIndex(levelNames: readonly string[]): number {
    const last = this.data.lastLevel === null ? -1 : levelNames.indexOf(this.data.lastLevel);
    if (last >= 0 && this.isUnlocked(levelNames, last)) return last;
    const unsolved = levelNames.findIndex((name) => !this.isSolved(name));
    return unsolved >= 0 ? unsolved : 0;
  }

  setLastLevel(levelName: string): void {
    if (this.data.lastLevel === levelName) return;
    this.data.lastLevel = levelName;
    this.save();
  }

  get settings(): Readonly<Settings> {
    return this.data.settings;
  }

  updateSettings(changes: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...changes };
    this.save();
  }

  /** Forget everything, including settings. */
  reset(): void {
    this.data = emptyData();
    try {
      this.store?.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the in-memory reset still applies.
    }
  }

  private load(): SaveData {
    let raw: string | null = null;
    try {
      raw = this.store?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return emptyData();
    }
    if (raw === null) return emptyData();
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      return emptyData();
    }
  }

  private save(): void {
    try {
      this.store?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Quota exceeded or storage blocked: keep playing with in-memory progress.
    }
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Validate parsed save data field by field, dropping anything malformed rather than trusting it. */
function sanitize(parsed: unknown): SaveData {
  if (!isObject(parsed) || parsed.version !== VERSION) return emptyData();
  const data = emptyData();
  if (isObject(parsed.levels)) {
    for (const [name, r] of Object.entries(parsed.levels)) {
      if (!isObject(r)) continue;
      data.levels[name] = {
        attempts: count(r.attempts),
        wins: count(r.wins),
        bestSaved: count(r.bestSaved),
        fastestWin: typeof r.fastestWin === "number" && r.fastestWin >= 0 ? r.fastestWin : null,
        firstWonAt: typeof r.firstWonAt === "string" ? r.firstWonAt : null,
      };
    }
  }
  if (typeof parsed.lastLevel === "string") data.lastLevel = parsed.lastLevel;
  if (isObject(parsed.settings) && typeof parsed.settings.showGrid === "boolean") {
    data.settings.showGrid = parsed.settings.showGrid;
  }
  return data;
}
