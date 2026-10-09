import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP } from "../config";
import { Crowd } from "../entities/Crowd";
import type { KeyValueStore } from "../progress/Progress";
import { parseLevel, type LevelData } from "../world/Level";
import { LEVELS } from "../world/levels";
import { TileType } from "../world/TileType";
import { DRAFT_KEY, loadDraft, saveDraft } from "./draftStore";
import { LevelDraft } from "./LevelDraft";
import { shareUrl } from "./levelShare";
import { parseLevelText } from "./levelText";

const rows = (d: LevelDraft) => d.toLevelData().map;
const tile = (d: LevelDraft, x: number, y: number) => d.grid.get(x, y);

/** A small flat level: hatch on the left, goal on the right, floor in between. */
const FLAT: LevelData = {
  name: "Flat",
  lemmingCount: 3,
  requiredToSave: 3,
  map: ["..........", ".S......G.", "##########", ".........."],
};

describe("LevelDraft painting", () => {
  it("starts as an empty map with no hatch", () => {
    const d = new LevelDraft();
    expect(d.spawn).toBeNull();
    expect(rows(d).every((r) => /^\.+$/.test(r))).toBe(true);
  });

  it("paints a tile and reports whether it changed", () => {
    const d = new LevelDraft();
    expect(d.paint({ x: 3, y: 4 }, TileType.Dirt)).toBe(true);
    expect(tile(d, 3, 4)).toBe(TileType.Dirt);
    expect(d.paint({ x: 3, y: 4 }, TileType.Dirt)).toBe(false);
    expect(d.paint({ x: -1, y: 0 }, TileType.Dirt)).toBe(false);
  });

  it("moves the hatch rather than adding a second, and keeps its tile empty", () => {
    const d = new LevelDraft();
    d.paint({ x: 2, y: 2 }, TileType.Dirt);
    d.paint({ x: 2, y: 2 }, "spawn");
    expect(d.spawn).toEqual({ x: 2, y: 2 });
    expect(tile(d, 2, 2)).toBe(TileType.Empty);
    d.paint({ x: 5, y: 5 }, "spawn");
    expect(d.spawn).toEqual({ x: 5, y: 5 });
    expect(rows(d).join("").split("S")).toHaveLength(2);
  });

  it("removes the hatch when any tile is painted over it, including Empty", () => {
    const d = new LevelDraft();
    d.paint({ x: 1, y: 1 }, "spawn");
    d.paint({ x: 1, y: 1 }, TileType.Empty);
    expect(d.spawn).toBeNull();
    d.paint({ x: 1, y: 1 }, "spawn");
    d.paint({ x: 1, y: 1 }, TileType.Wall);
    expect(d.spawn).toBeNull();
    expect(tile(d, 1, 1)).toBe(TileType.Wall);
  });

  it("fills the gaps in a fast drag with a line", () => {
    const d = new LevelDraft();
    d.stroke({ x: 0, y: 0 }, TileType.Wall);
    d.stroke({ x: 6, y: 0 }, TileType.Wall); // one sample, six tiles away
    d.endStroke();
    expect(rows(d)[0]!.slice(0, 8)).toBe("XXXXXXX.");
  });

  it("does not join separate strokes", () => {
    const d = new LevelDraft();
    d.stroke({ x: 0, y: 0 }, TileType.Wall);
    d.endStroke();
    d.stroke({ x: 6, y: 0 }, TileType.Wall);
    d.endStroke();
    expect(rows(d)[0]!.slice(0, 8)).toBe("X.....X.");
  });

  it("flood-fills only the connected region of the same tile", () => {
    const d = new LevelDraft({ ...FLAT, map: ["...#....", "...#....", "...#....", "...#...S"] });
    expect(d.fill({ x: 0, y: 0 }, TileType.Water)).toBe(true);
    expect(rows(d)).toEqual(["~~~#....", "~~~#....", "~~~#....", "~~~#...S"]);
    expect(d.fill({ x: 0, y: 0 }, TileType.Water)).toBe(false);
  });

  it("filling over the hatch removes it; filling with the hatch just moves it", () => {
    const d = new LevelDraft({ ...FLAT, map: ["....", "..S."] });
    d.fill({ x: 0, y: 0 }, TileType.Dirt);
    expect(d.spawn).toBeNull();
    expect(rows(d)).toEqual(["####", "####"]);
    d.fill({ x: 1, y: 1 }, "spawn");
    expect(d.spawn).toEqual({ x: 1, y: 1 });
    expect(rows(d)).toEqual(["####", "#S##"]);
  });
});

describe("LevelDraft history", () => {
  it("undoes and redoes a stroke as one step", () => {
    const d = new LevelDraft();
    d.stroke({ x: 0, y: 0 }, TileType.Dirt);
    d.stroke({ x: 4, y: 0 }, TileType.Dirt);
    d.endStroke();
    expect(d.canUndo).toBe(true);
    d.undo();
    expect(rows(d)[0]).toMatch(/^\.+$/);
    expect(d.canUndo).toBe(false);
    expect(d.canRedo).toBe(true);
    d.redo();
    expect(rows(d)[0]!.slice(0, 6)).toBe("#####.");
  });

  it("ignores a stroke that changed nothing, and clears redo on a new edit", () => {
    const d = new LevelDraft();
    d.stroke({ x: 0, y: 0 }, TileType.Empty);
    d.endStroke();
    expect(d.canUndo).toBe(false);

    d.fill({ x: 0, y: 0 }, TileType.Dirt);
    d.undo();
    expect(d.canRedo).toBe(true);
    d.fill({ x: 0, y: 0 }, TileType.Wall);
    expect(d.canRedo).toBe(false);
  });

  it("restores the hatch on undo", () => {
    const d = new LevelDraft();
    d.stroke({ x: 2, y: 2 }, "spawn");
    d.endStroke();
    d.stroke({ x: 2, y: 2 }, TileType.Dirt);
    d.endStroke();
    expect(d.spawn).toBeNull();
    d.undo();
    expect(d.spawn).toEqual({ x: 2, y: 2 });
  });

  it("undoes in place on the same grid, so the renderer's listeners see each tile change", () => {
    const d = new LevelDraft();
    const grid = d.grid;
    const changes: string[] = [];
    grid.onChange((x, y, t) => changes.push(`${x},${y}=${t}`));
    d.fill({ x: 0, y: 0 }, TileType.Dirt);
    changes.length = 0;
    d.undo();
    expect(d.grid).toBe(grid);
    expect(changes).toHaveLength(grid.cols * grid.rows);
  });

  it("clear empties the map and is undoable", () => {
    const d = new LevelDraft(FLAT);
    d.clear();
    expect(d.spawn).toBeNull();
    expect(rows(d).every((r) => /^\.+$/.test(r))).toBe(true);
    d.undo();
    expect(rows(d)).toEqual(FLAT.map);
  });
});

describe("LevelDraft resize", () => {
  it("grows with empty tiles and keeps the top-left corner", () => {
    const d = new LevelDraft(FLAT);
    d.resize(12, 6);
    expect(d.grid.cols).toBe(12);
    expect(d.grid.rows).toBe(6);
    expect(rows(d)[2]).toBe("##########..");
    expect(rows(d)[5]).toBe("............");
    expect(d.spawn).toEqual({ x: 1, y: 1 });
  });

  it("crops, dropping the hatch if it falls outside", () => {
    const d = new LevelDraft(FLAT);
    d.paint({ x: 9, y: 3 }, "spawn");
    d.resize(8, 6);
    expect(rows(d)[1]).toBe("........"); // the hatch moved to column 9, which is cropped away
    expect(d.spawn).toBeNull();
    d.undo();
    expect(d.spawn).toEqual({ x: 9, y: 3 });
  });

  it("clamps to the allowed size and undoes back to the old grid", () => {
    const d = new LevelDraft(FLAT);
    d.resize(1000, 1);
    expect(d.grid.cols).toBe(64);
    expect(d.grid.rows).toBe(6);
    d.undo();
    expect(d.grid.cols).toBe(10);
    expect(d.grid.rows).toBe(4);
    expect(rows(d)).toEqual(FLAT.map);
  });
});

describe("LevelDraft parameters", () => {
  it("rounds and clamps, and ignores non-numbers", () => {
    const d = new LevelDraft();
    d.setNumber("lemmingCount", 12.6);
    expect(d.getNumber("lemmingCount")).toBe(13);
    d.setNumber("lemmingCount", 0);
    expect(d.getNumber("lemmingCount")).toBe(1);
    d.setNumber("releaseRate", 500);
    expect(d.getNumber("releaseRate")).toBe(99);
    d.setNumber("dig", -4);
    expect(d.getNumber("dig")).toBe(0);
    d.setNumber("dig", Number.NaN);
    expect(d.getNumber("dig")).toBe(0);
  });

  it("exports only what differs from the defaults", () => {
    const d = new LevelDraft(FLAT);
    expect(d.toLevelData()).toEqual(FLAT);
    d.setNumber("dig", 4);
    d.setNumber("climber", 2);
    d.setNumber("bricks", 3);
    d.setNumber("releaseRate", 30);
    expect(d.toLevelData()).toMatchObject({
      releaseRate: 30,
      bricks: 3,
      tools: { dig: 4 },
      skills: { climber: 2 },
    });
    expect(d.toLevelData().tools).not.toHaveProperty("build");
  });
});

describe("LevelDraft problems", () => {
  it("lists what blocks a playtest", () => {
    const d = new LevelDraft();
    expect(d.problems()).toEqual(["Place the spawn hatch.", "Add a goal."]);
    d.name = "  ";
    d.setNumber("lemmingCount", 2);
    d.setNumber("requiredToSave", 5);
    expect(d.problems()).toHaveLength(4);
  });

  it("is clear for a finished level and warns about a name clash", () => {
    const d = new LevelDraft(FLAT);
    expect(d.problems()).toEqual([]);
    expect(d.warnings(["Other"])).toEqual([]);
    expect(d.warnings(["Flat"])).toHaveLength(1);
  });
});

describe("export and import", () => {
  it("round-trips every built-in level through toSource and parseLevelText", () => {
    for (const data of LEVELS) {
      const draft = new LevelDraft(data);
      expect(draft.toLevelData()).toEqual(data);
      expect(parseLevelText(draft.toSource())).toEqual(data);
    }
  });

  it("writes source in the style of levels.ts, ready to paste into the array", () => {
    const d = new LevelDraft({ ...FLAT, bricks: 2, tools: { dig: 5, build: 1 } });
    expect(d.toSource()).toBe(
      [
        "  {",
        '    name: "Flat",',
        "    lemmingCount: 3,",
        "    requiredToSave: 3,",
        "    bricks: 2,",
        "    tools: { dig: 5, build: 1 },",
        "    map: [",
        '      "..........",',
        '      ".S......G.",',
        '      "##########",',
        '      "..........",',
        "    ],",
        "  },",
      ].join("\n"),
    );
  });

  it("keeps awkward names intact", () => {
    const name = 'Dig: it, "now": {yes}';
    const d = new LevelDraft({ ...FLAT, name });
    expect(parseLevelText(d.toSource()).name).toBe(name);
  });

  it("replaceWith adopts a parsed level, undoably", () => {
    const d = new LevelDraft(FLAT);
    d.replaceWith(parseLevelText(new LevelDraft(LEVELS[1]!).toSource()));
    expect(d.name).toBe(LEVELS[1]!.name);
    expect(d.getNumber("dig")).toBe(6);
    expect(d.grid.cols).toBe(48);
    d.undo();
    expect(rows(d)).toEqual(FLAT.map);
  });

  it("replaceWith throws on a bad map and leaves the draft alone", () => {
    const d = new LevelDraft(FLAT);
    expect(() => d.replaceWith({ ...FLAT, name: "Bad", map: ["..", "..."] })).toThrow(/row 1/);
    expect(d.name).toBe("Flat");
    expect(rows(d)).toEqual(FLAT.map);
  });
});

describe("a drawn level", () => {
  const play = (data: LevelData) => {
    const level = parseLevel(data);
    const crowd = new Crowd(level);
    const world = { grid: level.grid, lemmings: crowd.lemmings };
    for (let i = 0; i < 120 / FIXED_TIMESTEP && !crowd.finished; i++) crowd.update(world, FIXED_TIMESTEP);
    return crowd;
  };

  it("plays: walking across a drawn floor to a drawn goal saves everyone", () => {
    const d = new LevelDraft();
    d.resize(16, 8);
    d.stroke({ x: 0, y: 5 }, TileType.Dirt);
    d.stroke({ x: 15, y: 5 }, TileType.Dirt);
    d.endStroke();
    d.paint({ x: 2, y: 4 }, "spawn");
    d.paint({ x: 13, y: 4 }, TileType.Goal);
    d.setNumber("lemmingCount", 4);
    d.setNumber("requiredToSave", 4);
    expect(d.problems()).toEqual([]);
    const crowd = play(d.toLevelData());
    expect(crowd.finished).toBe(true);
    expect(crowd.saved).toBe(4);
  });

  it("is lost when the floor has a gap (the draft is what's simulated)", () => {
    const d = new LevelDraft();
    d.resize(16, 8);
    d.stroke({ x: 0, y: 5 }, TileType.Dirt);
    d.stroke({ x: 15, y: 5 }, TileType.Dirt);
    d.endStroke();
    d.stroke({ x: 7, y: 5 }, TileType.Empty);
    d.stroke({ x: 8, y: 5 }, TileType.Empty);
    d.endStroke();
    d.paint({ x: 2, y: 4 }, "spawn");
    d.paint({ x: 13, y: 4 }, TileType.Goal);
    d.setNumber("lemmingCount", 2);
    d.setNumber("requiredToSave", 1);
    expect(play(d.toLevelData()).saved).toBe(0);
  });
});

describe("parseLevelText", () => {
  it("reads plain JSON", () => {
    expect(parseLevelText(JSON.stringify(FLAT))).toEqual(FLAT);
  });

  it("reads map rows, quoted or bare, with defaults for the rest", () => {
    const bare = parseLevelText("..S.\n.##.\n");
    expect(bare.map).toEqual(["..S.", ".##."]);
    expect(bare).toMatchObject({ lemmingCount: 10, requiredToSave: 5 });
    expect(parseLevelText('  "..S.",\n  ".##.",\n').map).toEqual(["..S.", ".##."]);
  });

  it("reads one array element pasted from levels.ts, with unknown fields dropped", () => {
    const text = `{
      name: "Pasted",
      lemmingCount: 4,
      requiredToSave: 2,
      colour: "red",
      skills: { climber: 1, juggler: 9 },
      map: [
        "S..",
        "###",
      ],
    },`;
    expect(parseLevelText(text)).toEqual({
      name: "Pasted",
      lemmingCount: 4,
      requiredToSave: 2,
      skills: { climber: 1 },
      map: ["S..", "###"],
    });
  });

  it("reads a pasted share link", () => {
    const link = shareUrl("https://example.com/lemmings/", FLAT);
    expect(parseLevelText(link)).toEqual(FLAT);
    expect(parseLevelText(`  ${link}\n`)).toEqual(FLAT);
    expect(() => parseLevelText("https://example.com/#level=%%%")).toThrow();
  });

  it("explains what went wrong", () => {
    expect(() => parseLevelText("   ")).toThrow(/paste a level/);
    expect(() => parseLevelText("{ name: ")).toThrow(/Couldn't read/);
    expect(() => parseLevelText('{ name: "No map" }')).toThrow(/needs a `map`/);
  });
});

describe("draft storage", () => {
  const memory = (): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  };

  it("saves and loads a draft, including one that has no hatch yet", () => {
    const store = memory();
    const d = new LevelDraft();
    d.name = "Half done";
    d.paint({ x: 3, y: 3 }, TileType.Dirt);
    saveDraft(store, d.toLevelData());
    const loaded = loadDraft(store)!;
    expect(loaded.name).toBe("Half done");
    expect(new LevelDraft(loaded).spawn).toBeNull();
    expect(new LevelDraft(loaded).grid.get(3, 3)).toBe(TileType.Dirt);
  });

  it("treats missing, corrupt and unusable data as no draft", () => {
    const store = memory();
    expect(loadDraft(store)).toBeNull();
    expect(loadDraft(null)).toBeNull();
    for (const bad of ["{oops", "[]", '{"map":["..","..."]}', '{"map":[1]}']) {
      store.setItem(DRAFT_KEY, bad);
      expect(loadDraft(store)).toBeNull();
    }
  });

  it("survives a store that throws", () => {
    const hostile: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {},
    };
    expect(loadDraft(hostile)).toBeNull();
    expect(() => saveDraft(hostile, FLAT)).not.toThrow();
  });
});

describe("time limits", () => {
  it("survives source, JSON and draft storage round trips", () => {
    const data = { ...FLAT, timeLimit: 75 };
    const draft = new LevelDraft(data);
    expect(parseLevelText(draft.toSource())).toEqual(data);
    expect(parseLevelText(JSON.stringify(data))).toEqual(data);
    const saved = new Map<string, string>();
    const store = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { saved.set(key, value); },
      removeItem: (key: string) => { saved.delete(key); },
    };
    saveDraft(store, draft.toLevelData());
    expect(loadDraft(store)).toEqual(data);
  });

  it("defaults old drafts to untimed and normalizes imported limits", () => {
    const draft = new LevelDraft(FLAT);
    expect(draft.getNumber("timeLimit")).toBe(0);
    expect(draft.toLevelData().timeLimit).toBeUndefined();
    draft.setNumber("timeLimit", 75.4);
    expect(draft.toLevelData().timeLimit).toBe(75);
    draft.setNumber("timeLimit", Infinity);
    expect(draft.toLevelData().timeLimit).toBe(75);
    draft.setNumber("timeLimit", 9000);
    expect(draft.toLevelData().timeLimit).toBe(3600);
    draft.setNumber("timeLimit", -10);
    expect(draft.toLevelData().timeLimit).toBeUndefined();
    draft.setNumber("timeLimit", 60);
    draft.replaceWith(FLAT);
    expect(draft.getNumber("timeLimit")).toBe(0);
  });
});
