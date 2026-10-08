import { describe, expect, it } from "vitest";
import { Progress, STORAGE_KEY, type KeyValueStore } from "./Progress";

/** In-memory stand-in for localStorage. */
function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  };
}

const failingStore: KeyValueStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const NAMES = ["One", "Two", "Three"];
const fixedNow = () => new Date("2026-10-03T12:00:00Z");

describe("Progress", () => {
  it("starts empty", () => {
    const p = new Progress(memoryStore());
    expect(p.get("One")).toEqual({ attempts: 0, wins: 0, bestSaved: 0, fastestWin: null, firstWonAt: null });
    expect(p.isSolved("One")).toBe(false);
    expect(p.solvedCount(NAMES)).toBe(0);
    expect(p.settings.showGrid).toBe(false);
    expect(p.settings.soundEnabled).toBe(true);
  });

  it("records a loss without solving the level", () => {
    const p = new Progress(memoryStore());
    const update = p.record("One", { won: false, saved: 3, time: 40 });
    expect(update).toMatchObject({ firstWin: false, newBestSaved: true, newFastestWin: false });
    expect(p.get("One")).toMatchObject({ attempts: 1, wins: 0, bestSaved: 3, fastestWin: null });
    expect(p.isSolved("One")).toBe(false);
  });

  it("records the first win, then only reports genuine improvements", () => {
    const p = new Progress(memoryStore(), fixedNow);
    expect(p.record("One", { won: true, saved: 7, time: 60 })).toMatchObject({
      firstWin: true,
      newBestSaved: true,
      newFastestWin: false,
    });
    expect(p.get("One")).toMatchObject({ wins: 1, fastestWin: 60, firstWonAt: "2026-10-03T12:00:00.000Z" });

    // Slower, fewer saved: nothing new.
    expect(p.record("One", { won: true, saved: 6, time: 70 })).toMatchObject({
      firstWin: false,
      newBestSaved: false,
      newFastestWin: false,
    });
    // Faster and more saved.
    expect(p.record("One", { won: true, saved: 9, time: 50 })).toMatchObject({ newBestSaved: true, newFastestWin: true });
    // A loss never touches the fastest win.
    p.record("One", { won: false, saved: 2, time: 10 });

    expect(p.get("One")).toEqual({
      attempts: 4,
      wins: 3,
      bestSaved: 9,
      fastestWin: 50,
      firstWonAt: "2026-10-03T12:00:00.000Z",
    });
    expect(p.solvedCount(NAMES)).toBe(1);
  });

  it("persists across instances sharing a store", () => {
    const store = memoryStore();
    const a = new Progress(store);
    a.record("Two", { won: true, saved: 8, time: 30 });
    a.setLastLevel("Two");
    a.updateSettings({ showGrid: true, soundEnabled: false });

    const b = new Progress(store);
    expect(b.isSolved("Two")).toBe(true);
    expect(b.get("Two").bestSaved).toBe(8);
    expect(b.resumeIndex(NAMES)).toBe(1);
    expect(b.settings.showGrid).toBe(true);
    expect(b.settings.soundEnabled).toBe(false);
  });

  it("resumes at the last level played, else the first unsolved, else the first", () => {
    const p = new Progress(memoryStore());
    expect(p.resumeIndex(NAMES)).toBe(0);
    p.record("One", { won: true, saved: 5, time: 1 });
    expect(p.resumeIndex(NAMES)).toBe(1);
    p.setLastLevel("One");
    expect(p.resumeIndex(NAMES)).toBe(0);
    // A last level that no longer exists is ignored.
    p.setLastLevel("Removed");
    expect(p.resumeIndex(NAMES)).toBe(1);
    for (const name of NAMES) p.record(name, { won: true, saved: 5, time: 1 });
    expect(p.resumeIndex(NAMES)).toBe(0);
  });

  it("unlocks levels in order as each one is solved", () => {
    const p = new Progress(memoryStore());
    const unlocked = () => NAMES.map((_, i) => p.isUnlocked(NAMES, i));
    expect(unlocked()).toEqual([true, false, false]);
    p.record("One", { won: false, saved: 1, time: 1 });
    expect(unlocked()).toEqual([true, false, false]);
    p.record("One", { won: true, saved: 5, time: 1 });
    expect(unlocked()).toEqual([true, true, false]);
    p.record("Two", { won: true, saved: 5, time: 1 });
    expect(unlocked()).toEqual([true, true, true]);
    expect(p.isUnlocked(NAMES, 3)).toBe(false);
    expect(p.isUnlocked(NAMES, -1)).toBe(false);
  });

  it("keeps a solved level unlocked when a new level is inserted before it", () => {
    const p = new Progress(memoryStore());
    p.record("Two", { won: true, saved: 5, time: 1 });
    expect(p.isUnlocked(["One", "New", "Two"], 2)).toBe(true);
    expect(p.isUnlocked(["One", "New", "Two"], 1)).toBe(false);
  });

  it("doesn't resume at a level that is locked", () => {
    const p = new Progress(memoryStore());
    p.setLastLevel("Three");
    expect(p.resumeIndex(NAMES)).toBe(0);
  });

  it("reset forgets everything, in memory and in storage", () => {
    const store = memoryStore();
    const p = new Progress(store);
    p.record("One", { won: true, saved: 5, time: 1 });
    p.updateSettings({ soundEnabled: false });
    p.reset();
    expect(p.isSolved("One")).toBe(false);
    expect(store.items.has(STORAGE_KEY)).toBe(false);
    expect(p.settings.soundEnabled).toBe(true);
  });

  it("falls back to a fresh start on corrupt, foreign-version or malformed data", () => {
    expect(new Progress(memoryStore({ [STORAGE_KEY]: "{not json" })).solvedCount(NAMES)).toBe(0);
    expect(new Progress(memoryStore({ [STORAGE_KEY]: '{"version":99,"levels":{"One":{"wins":1}}}' })).isSolved("One")).toBe(
      false,
    );

    const p = new Progress(
      memoryStore({
        [STORAGE_KEY]: JSON.stringify({
          version: 1,
          levels: { One: { attempts: "lots", wins: 2, bestSaved: -4, fastestWin: "fast" }, Two: null },
          lastLevel: 7,
          settings: { showGrid: "yes", soundEnabled: "yes" },
        }),
      }),
    );
    expect(p.get("One")).toEqual({ attempts: 0, wins: 2, bestSaved: 0, fastestWin: null, firstWonAt: null });
    expect(p.get("Two").wins).toBe(0);
    expect(p.resumeIndex(NAMES)).toBe(1);
    expect(p.settings.showGrid).toBe(false);
    expect(p.settings.soundEnabled).toBe(true);
  });

  it("loads old saves without losing scores or grid settings when sound settings are absent", () => {
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({
      version: 1, levels: { One: { attempts: 2, wins: 1, bestSaved: 8 } }, settings: { showGrid: true },
    }) });
    const p = new Progress(store);
    expect(p.get("One")).toMatchObject({ attempts: 2, wins: 1, bestSaved: 8 });
    expect(p.settings).toEqual({ showGrid: true, soundEnabled: true });
  });

  it("keeps working in memory when storage throws or is unavailable", () => {
    for (const store of [failingStore, null]) {
      const p = new Progress(store);
      p.record("One", { won: true, saved: 5, time: 1 });
      p.updateSettings({ showGrid: true });
      expect(p.isSolved("One")).toBe(true);
      expect(p.settings.showGrid).toBe(true);
      expect(() => p.reset()).not.toThrow();
    }
  });
});
