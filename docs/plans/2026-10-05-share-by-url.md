# Plan: Share a level by URL

Goal: close the "share a level as a URL" item in `features-to-add.md`. Build a level in the editor, copy one link,
and anyone who opens it plays it. No server, no accounts: the level is in the hash.

## What it does

- **Share** (editor, next to Export / import) copies `https://<page>#level=<payload>`. The button is disabled while
  the level can't be played (same rule as Playtest). If the clipboard is blocked, the export box opens with the
  link selected to copy by hand.
- **Opening a link** (at launch, or pasting one into an open tab) starts the level at once under a **SHARED LEVEL**
  banner, in place of the level select. Nothing is saved: it's the playtest machinery again (`Game.playtest(data,
  "link")`), so `R` restarts it, `L` goes to the real levels, and `E` opens the editor and comes back to a fresh copy.
- **Edit a copy** on the shared level's result panel puts it in the editor, after a confirm, because it replaces the
  draft. Pasting a link into Export / import does the same without playing it.
- The hash is cleared as soon as it's read, so a reload goes to the normal game rather than replaying the link,
  and a bad link says why (`alert`) and falls back to the level select.

## The format

`base64url( "1" | encodeURIComponent(name) | "lemmingCount:10,requiredToSave:6,bricks:2,dig:20" | map )`

- **Map:** each row run-length encoded (`12.` is twelve empty tiles; a single tile has no count), identical
  consecutive rows collapsed (`row*4`), rows joined by `/`. LEGEND characters contain no digits, `*`, `/` or `|`,
  so the packing is unambiguous. Built-in levels come to about 200 characters (48×28); a full 64×40 map of pure
  noise is the worst case and still fits well under the 12,000 cap.
- **Numbers:** only those that differ from a fresh level, keyed by the editor's `FieldId`s, so new tools or skills
  need no format change. Unknown keys are ignored.
- **Name:** URI-escaped, so `|`, `:`, emoji and the rest survive (tested).
- **Version:** the leading `1`. A later format gets a new number; old links then fail with "isn't one this version
  understands" instead of being misread.

Alternatives considered: deflate via `CompressionStream` (shorter links, but async and browser-only, which would
pull the codec out of the headless-testable layer, and RLE is already small for these maps), and JSON in base64
(trivial, but ~5x longer).

## Treating the link as hostile

Anyone can craft a link, and opening it feeds their data into the game. `decodeLevel` therefore:

- rejects payloads over 12,000 characters before decoding them;
- reads at most three digits of a run or repeat count, and checks the running width/height against the editor's
  limits (64 × 40) *before* building a row, so `999999999.` can't allocate anything;
- refuses unknown tiles, ragged rows, bad escapes, bad base64 and invalid UTF-8;
- builds the level through `LevelDraft`, which clamps every number, and requires it to pass `problems()` (a hatch,
  a goal, a save target within the lemming count), so a link can't start an unplayable session;
- only ever shows the name through `textContent` (the HUD and result panel), never as HTML.

## Tests

- `editor/levelShare.test.ts` (30): every built-in level round-trips exactly; every number; awkward names; URL-safe
  alphabet and length; RLE sizes; a noisy full-size map; `shareUrl` replacing an existing hash; `levelFromHash` with
  and without `#`, and for non-level hashes; 17 hostile or damaged payloads (each refused with its own message) plus an over-long one;
  number clamping and unknown keys; names like `__proto__` don't reach the data.
- `LevelDraft.test.ts`: a pasted link imports, and a damaged one gives the link error rather than a map error.
- Checked end to end in Chromium (not committed): copy a built-in level, rename it with emoji and a pipe, Share,
  read the clipboard, open the link in a *second browser profile*, play it to the result panel, check progress is
  untouched, reload (no replay), **Edit a copy**, back out of the editor, a link pasted into an open tab
  (`hashchange`), a damaged link and a hostile one, clipboard-denied fallback, import of a pasted link, and Share
  disabled for an unplayable level.

## Not done / next

- Links carry the level, not a solution, and nothing tells the sender whether it can be won. Recording a playtest's
  inputs (the replay item in the backlog) could ride along in the link as "here's how I beat it".
- A "my levels" shelf: received levels aren't remembered, so the link is the only way back to one.
- Very large links: browsers and chat apps cope with a few thousand characters, but a noisy 64×40 map would be a
  long URL. Compression would help if levels like that turn out to be common.
