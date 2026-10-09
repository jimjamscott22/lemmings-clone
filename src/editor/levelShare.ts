import { RELEASE_RATE_DEFAULT } from "../config";
import { LEGEND, parseMap, type LevelData } from "../world/Level";
import { DRAFT_FIELDS, GRID_LIMITS, LevelDraft, type FieldId } from "./LevelDraft";

/** The hash a shared level lives in: `#level=<payload>`. */
const HASH_PREFIX = "level=";
const FORMAT_VERSION = "1";
// Older clients must refuse timed levels rather than silently discard the deadline.
const TIMED_FORMAT_VERSION = "2";
/** Longest payload accepted. A full-size map of pure noise encodes to under this. */
const MAX_PAYLOAD = 12000;

const FIELD_IDS: ReadonlySet<string> = new Set(DRAFT_FIELDS.map((f) => f.id));

/**
 * Pack a level into URL-safe text. Layout before base64url: `version|name|key:value,...|map`.
 * The name is URI-escaped so it can hold any character, only numbers that differ from their
 * default are written, and the map rows are run-length encoded (`12.` for twelve empty tiles,
 * `row*4` for four identical rows), which keeps a typical level to a few hundred characters.
 */
export function encodeLevel(data: LevelData): string {
  const draft = new LevelDraft(data); // normalises names and numbers the same way decoding will
  const { name, map, timeLimit } = draft.toLevelData();
  const numbers = DRAFT_FIELDS.map((f) => [f.id, draft.getNumber(f.id)] as const)
    // Only what differs from a fresh level. lemmingCount and requiredToSave are never 0, so always written.
    .filter(([id, n]) => (id === "releaseRate" ? n !== RELEASE_RATE_DEFAULT : n !== 0))
    .map(([id, n]) => `${id}:${n}`);
  const version = timeLimit ? TIMED_FORMAT_VERSION : FORMAT_VERSION;
  return toBase64Url([version, encodeURIComponent(name), numbers.join(","), packMap(map)].join("|"));
}

/**
 * Read a level back from `encodeLevel`'s output. The text comes from a link anyone can craft, so
 * everything is checked: size caps before anything is expanded, numbers clamped, and the level must
 * be playable (a hatch and a goal). Throws an Error with a message fit to show the player.
 */
export function decodeLevel(payload: string): LevelData {
  if (payload.length > MAX_PAYLOAD) throw new Error("That level link is too long to be a level.");
  const parts = fromBase64Url(payload).split("|");
  if (parts.length !== 4 || (parts[0] !== FORMAT_VERSION && parts[0] !== TIMED_FORMAT_VERSION)) {
    throw new Error("That level link isn't one this version understands.");
  }
  const [, name, numbers, map] = parts as [string, string, string, string];

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(name);
  } catch {
    throw new Error("That level link is damaged.");
  }
  const draft = new LevelDraft({ name: decodedName, map: unpackMap(map), lemmingCount: 10, requiredToSave: 5 });
  for (const pair of numbers ? numbers.split(",") : []) {
    const [id, value] = pair.split(":");
    if (id && value !== undefined && FIELD_IDS.has(id)) draft.setNumber(id as FieldId, Number(value));
  }
  const problems = draft.problems();
  if (problems.length > 0) throw new Error(`That level can't be played: ${problems.join(" ")}`);
  return draft.toLevelData();
}

/** A link to `data`, replacing any hash already on `base`. */
export function shareUrl(base: string, data: LevelData): string {
  return `${base.split("#")[0]}#${HASH_PREFIX}${encodeLevel(data)}`;
}

/** The level in a `location.hash`, or null if the hash isn't a level link. Throws if it is one but is unreadable. */
export function levelFromHash(hash: string): LevelData | null {
  const match = /^#?level=([A-Za-z0-9_-]*)$/.exec(hash);
  return match ? decodeLevel(match[1]!) : null;
}

/* Map packing */

function packMap(map: readonly string[]): string {
  const rows: string[] = [];
  for (let i = 0; i < map.length; ) {
    let repeat = 1;
    while (map[i + repeat] === map[i]) repeat++;
    rows.push(packRow(map[i]!) + (repeat > 1 ? `*${repeat}` : ""));
    i += repeat;
  }
  return rows.join("/");
}

function packRow(row: string): string {
  let out = "";
  for (let i = 0; i < row.length; ) {
    let run = 1;
    while (row[i + run] === row[i]) run++;
    out += (run > 1 ? run : "") + row[i];
    i += run;
  }
  return out;
}

/** Expand packed rows, refusing sizes beyond the editor's limits before building anything. */
function unpackMap(packed: string): string[] {
  const rows: string[] = [];
  for (const token of packed.split("/")) {
    const [body, times, extra] = token.split("*");
    if (!body || extra !== undefined || (times !== undefined && !/^\d{1,3}$/.test(times))) throw new Error("That level link is damaged.");
    const repeat = times === undefined ? 1 : Number(times);
    if (repeat < 1 || rows.length + repeat > GRID_LIMITS.maxRows) throw new Error("That level is taller than the editor allows.");
    const row = unpackRow(body);
    for (let i = 0; i < repeat; i++) rows.push(row);
  }
  if (new Set(rows.map((r) => r.length)).size > 1) throw new Error("That level link is damaged.");
  parseMap({ name: "shared", map: rows }); // unknown tiles, empty map
  return rows;
}

function unpackRow(body: string): string {
  let row = "";
  for (const [, count, ch] of body.matchAll(/(\d{0,3})(.)/gs)) {
    if (!(ch! in LEGEND)) throw new Error("That level link has a tile this version doesn't know.");
    const run = count ? Number(count) : 1;
    if (run < 1 || row.length + run > GRID_LIMITS.maxCols) throw new Error("That level is wider than the editor allows.");
    row += ch!.repeat(run);
  }
  return row;
}

/* base64url over UTF-8 */

function toBase64Url(text: string): string {
  const binary = Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(payload: string): string {
  try {
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    throw new Error("That level link is damaged.");
  }
}
