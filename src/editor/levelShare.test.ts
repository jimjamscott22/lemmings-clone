import { describe, expect, it } from "vitest";
import { LEVELS } from "../world/levels";
import type { LevelData } from "../world/Level";
import { LevelDraft } from "./LevelDraft";
import { decodeLevel, encodeLevel, levelFromHash, shareUrl } from "./levelShare";

const FLAT: LevelData = {
  name: "Flat",
  lemmingCount: 3,
  requiredToSave: 3,
  map: ["..........", ".S......G.", "##########", ".........."],
};

/** Build a payload by hand, for feeding the decoder things `encodeLevel` would never write. */
const b64 = (text: string) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const payload = (name: string, numbers: string, map: string, version = "1") => b64([version, name, numbers, map].join("|"));

describe("level links", () => {
  it("round-trip every built-in level exactly", () => {
    for (const data of LEVELS) expect(decodeLevel(encodeLevel(data))).toEqual(data);
  });

  it("keep every number: release rate, bricks, tool and skill charges", () => {
    const data: LevelData = {
      ...FLAT,
      releaseRate: 73,
      bricks: 4,
      tools: { dig: 9, build: 2 },
      skills: { climber: 1, floater: 2, bomber: 3, blocker: 4, basher: 5, miner: 6 },
    };
    expect(decodeLevel(encodeLevel(data))).toEqual(data);
  });

  it("keep any name: spaces, pipes, colons, quotes, accents and emoji", () => {
    for (const name of ["a b", "x|y|z", "k:v,k:v", 'say "hi"', "Über-Tunnel", "日本語", "Lem 🐹 mings", "100%", "a/b*c"]) {
      expect(decodeLevel(encodeLevel({ ...FLAT, name })).name).toBe(name);
    }
  });

  it("are URL-safe and short for real levels", () => {
    for (const data of LEVELS) {
      const text = encodeLevel(data);
      expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(text.length).toBeLessThan(500); // the biggest built-in map is 48x28
    }
  });

  it("run-length encode: a big empty map stays tiny, and repeated rows cost one entry", () => {
    const empty = Array.from({ length: 40 }, (_, y) => (y === 3 ? ".S" + ".".repeat(60) + "G" : ".".repeat(63)));
    expect(encodeLevel({ ...FLAT, map: empty }).length).toBeLessThan(200);
  });

  it("survive a worst-case noisy full-size map", () => {
    const noise = Array.from({ length: 40 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => (y === 0 && x === 0 ? "S" : y === 1 && x === 0 ? "G" : ".#X~="[(x * 7 + y * 13) % 5]!)).join(""),
    );
    const data = { ...FLAT, map: noise };
    expect(decodeLevel(encodeLevel(data))).toEqual(data);
  });
});

describe("shareUrl and levelFromHash", () => {
  it("builds a link on the page address, replacing any hash", () => {
    const url = shareUrl("https://example.com/lemmings/?x=1#level=old", FLAT);
    expect(url.startsWith("https://example.com/lemmings/?x=1#level=")).toBe(true);
    expect(url.match(/#/g)).toHaveLength(1);
    expect(levelFromHash(url.slice(url.indexOf("#")))).toEqual(FLAT);
  });

  it("reads a hash with or without the leading #", () => {
    const hash = shareUrl("http://x/", FLAT).slice("http://x/".length);
    expect(levelFromHash(hash)).toEqual(FLAT);
    expect(levelFromHash(hash.slice(1))).toEqual(FLAT);
  });

  it("ignores hashes that aren't level links, and throws on a level link it can't read", () => {
    for (const hash of ["", "#", "#top", "#levels=abc", "#level=ab cd", "#level=ab=="]) expect(levelFromHash(hash)).toBeNull();
    expect(() => levelFromHash("#level=")).toThrow(/isn't one|damaged/);
    expect(() => levelFromHash("#level=!!!")).not.toThrow(); // not a level link at all
  });
});

describe("a hostile or damaged link is refused, not expanded", () => {
  const ok = "..S.......G";
  const cases: Array<[string, string, RegExp]> = [
    ["not base64", "%%%", /damaged/],
    ["not UTF-8", b64("\xff\xfe\xfd"), /damaged/],
    ["an unknown version", payload("x", "", ok, "9"), /isn't one this version/],
    ["the wrong number of parts", b64("1|x|y"), /isn't one this version/],
    ["a huge run (would allocate gigabytes)", payload("x", "", "999999999."), /wider|damaged|know/],
    ["a run past the width limit", payload("x", "", "65."), /wider/],
    ["rows past the height limit", payload("x", "", `${ok}*41`), /taller/],
    ["a repeat count that isn't a number", payload("x", "", `${ok}*x`), /damaged/],
    ["a zero repeat", payload("x", "", `${ok}*0`), /taller|damaged/],
    ["an empty row", payload("x", "", `${ok}//${ok}`), /damaged/],
    ["ragged rows", payload("x", "", `${ok}/..`), /damaged/],
    ["an unknown tile", payload("x", "", "..S?..G"), /tile this version doesn't know/],
    ["a run count with no tile after it", payload("x", "", "..S.G9"), /know/],
    ["a bad name escape", payload("%E0%A4%A", "", ok), /damaged/],
    ["no hatch", payload("x", "", "......G"), /hatch/],
    ["no goal", payload("x", "", "..S...."), /goal/],
    ["a save target above the lemmings", payload("x", "lemmingCount:2,requiredToSave:9", ok), /Save target/],
  ];
  for (const [name, text, message] of cases) {
    it(`refuses ${name}`, () => {
      expect(() => decodeLevel(text)).toThrow(message);
    });
  }

  it("refuses an over-long payload before decoding it", () => {
    expect(() => decodeLevel("A".repeat(12001))).toThrow(/too long/);
  });

  it("clamps absurd numbers and ignores unknown or malformed ones", () => {
    const data = decodeLevel(payload("x", "lemmingCount:9999999,requiredToSave:2,dig:-5,bricks:abc,nonsense:7,releaseRate:500,:,climber", ok));
    expect(data.lemmingCount).toBe(99);
    expect(data.releaseRate).toBe(99);
    expect(data.tools).toBeUndefined();
    expect(data.bricks).toBeUndefined();
    expect(data.skills).toBeUndefined();
    expect(Object.keys(data).sort()).toEqual(["lemmingCount", "map", "name", "releaseRate", "requiredToSave"]);
  });

  it("does not let a name or number reach the map (prototype keys and friends)", () => {
    const data = decodeLevel(payload("__proto__", "__proto__:1,constructor:2,toString:3", ok));
    expect(data.name).toBe("__proto__");
    expect(Object.keys(data)).not.toContain("constructor");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("only ever produces a level the editor would accept", () => {
    const data = decodeLevel(encodeLevel(FLAT));
    expect(new LevelDraft(data).problems()).toEqual([]);
  });
});

describe("timed level link compatibility", () => {
  const decodedText = (data: LevelData) => atob(encodeLevel(data).replace(/-/g, "+").replace(/_/g, "/"));

  it("uses version 2 for timed levels so older clients cannot silently omit the timer", () => {
    const timed = { ...FLAT, timeLimit: 90 };
    expect(decodedText(timed)).toMatch(/^2\|/);
    expect(decodeLevel(encodeLevel(timed))).toEqual(timed);
    expect(decodedText(FLAT)).toMatch(/^1\|/);
  });

  it("keeps legacy links untimed", () => {
    const legacy = payload("Legacy", "lemmingCount:3,requiredToSave:1", ".S......G./10X");
    expect(decodeLevel(legacy)).toMatchObject({ name: "Legacy", lemmingCount: 3, requiredToSave: 1 });
    expect(decodeLevel(legacy).timeLimit).toBeUndefined();
  });

  it("normalizes unsafe timer values", () => {
    for (const [value, expected] of [["-1", undefined], ["Infinity", undefined], ["oops", undefined], ["999999", 3600]] as const) {
      expect(decodeLevel(payload("Timer", `timeLimit:${value}`, ".S......G./10X", "2")).timeLimit).toBe(expected);
    }
  });
});
