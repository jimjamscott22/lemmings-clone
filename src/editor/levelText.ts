import { SKILL_ORDER, type SkillId } from "../skills/skills";
import { TOOL_ORDER, type ToolId } from "../tools/tools";
import type { LevelData } from "../world/Level";
import { decodeLevel } from "./levelShare";

/**
 * Turn the text an author pastes into a `LevelData`. Accepts what `LevelDraft.toSource` writes
 * (a TypeScript object literal as in `levels.ts`, trailing comma and all), plain JSON, just the
 * map rows (quoted or not), or a share link. Throws an Error with a message fit to show the author.
 */
export function parseLevelText(text: string): LevelData {
  const src = text.trim();
  if (!src) throw new Error("Nothing to import: paste a level first.");
  const link = /^https?:\/\/\S*?#level=(\S*)$/.exec(src); // whatever follows is for decodeLevel to judge
  if (link) return decodeLevel(link[1]!);
  if (src.startsWith("{")) {
    let raw: unknown;
    try {
      raw = JSON.parse(literalToJson(src));
    } catch {
      throw new Error("Couldn't read that as a level object. Paste it exactly as exported.");
    }
    return coerceLevelData(raw);
  }
  return { ...DEFAULTS, map: rowsFromText(src) };
}

const DEFAULTS = { name: "Imported level", lemmingCount: 10, requiredToSave: 5 } as const;

/** Map rows as bare lines, or as quoted strings with optional trailing commas (as in `levels.ts`). */
function rowsFromText(src: string): string[] {
  const rows = src
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^"([^"]*)",?$/, "$1"))
    .filter(Boolean);
  if (!rows.length) throw new Error("No map rows found.");
  return rows;
}

/**
 * Validate untrusted data (pasted text or a stored draft) into a `LevelData`, ignoring unknown
 * fields and replacing bad numbers with defaults. Only a missing map is an error; whether the
 * map itself is well-formed is for `parseMap` to say.
 */
export function coerceLevelData(raw: unknown): LevelData {
  if (typeof raw !== "object" || raw === null) throw new Error("Not a level.");
  const r = raw as Record<string, unknown>;
  const { map } = r;
  if (!Array.isArray(map) || map.length === 0 || !map.every((row) => typeof row === "string")) {
    throw new Error("The level needs a `map`: a list of strings, one per row.");
  }
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const data: LevelData = {
    name: typeof r.name === "string" && r.name.trim() ? r.name : DEFAULTS.name,
    lemmingCount: num(r.lemmingCount, DEFAULTS.lemmingCount),
    requiredToSave: num(r.requiredToSave, DEFAULTS.requiredToSave),
    map: map as string[],
  };
  if (typeof r.releaseRate === "number") data.releaseRate = r.releaseRate;
  if (typeof r.bricks === "number") data.bricks = r.bricks;
  const tools = counts(r.tools, TOOL_ORDER);
  if (tools) data.tools = tools;
  const skills = counts(r.skills, SKILL_ORDER);
  if (skills) data.skills = skills;
  return data;
}

/** Pick the known keys with numeric values out of an object, or undefined if there are none. */
function counts<K extends ToolId | SkillId>(raw: unknown, keys: readonly K[]): Partial<Record<K, number>> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const out: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Rewrite a JavaScript object literal as JSON: quote bare keys and drop trailing commas, leaving
 * string contents alone. Not a general JS parser; just enough for the `levels.ts` style.
 */
function literalToJson(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (/[A-Za-z_$]/.test(c)) {
      const word = /^[\w$]+/.exec(src.slice(i))![0];
      i += word.length;
      out += /^\s*:/.test(src.slice(i)) ? JSON.stringify(word) : word;
    } else if (/[\d-]/.test(c)) {
      const num = /^[\d.eE+-]+/.exec(src.slice(i))![0];
      i += num.length;
      out += num;
    } else if (c === "," && /^\s*([}\]]|$)/.test(src.slice(i + 1))) {
      i++; // trailing comma (also the one after the closing brace of a pasted array element)
    } else if (c === ";" && /^\s*$/.test(src.slice(i + 1))) {
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
