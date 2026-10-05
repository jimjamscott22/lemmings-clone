# Plan: Level editor

Goal: close the "in-browser level editor" item in `features-to-add.md` (section 5), so new levels are drawn
rather than typed as ASCII. The editor reuses the renderer, the tile layer, the Bresenham line code from
`Toolbox.ts` and the whole simulation, so a playtest is the real game.

## What it does

- `E` / the **Editor** button opens it. Brushes `1`–`7` (every `TileType`, then the spawn hatch), Pencil
  (`B`, drag) and Fill (`F`, click), undo/redo, resize (8–64 × 6–40), a name, and every `LevelData` number:
  lemmings, save target, release rate, bricks, tool and skill charges.
- **Playtest** (`P`) runs the draft as a normal session. Nothing is recorded: progress is keyed by level
  name and a draft may share one with a built-in level. `R` restarts it; `E`/`Esc` goes back to the editor.
- **Start from…** copies a blank map or any built-in level.
- **Export / import** shows the level as source in the style of `levels.ts` (ready to paste into `LEVELS`)
  and loads edited text back. Plain JSON and bare map rows import too.
- The draft autosaves to `localStorage` (own key), so a reload or closed tab loses nothing.
- The panel lists what blocks a playtest (no name, no hatch, no goal, save target above the lemming
  count) and warns when the name is already used by a built-in level.

## Design

| Piece | Where | Notes |
| --- | --- | --- |
| Model | `editor/LevelDraft.ts` | DOM-free. A real `Grid` plus the spawn *beside* it. Paint, stroke, fill, clear, resize, undo/redo, `problems()`, `toLevelData()`, `toSource()`. |
| Text | `editor/levelText.ts` | `parseLevelText` (a tolerant object-literal reader that leaves string contents alone, JSON, or map rows) and `coerceLevelData` (validates untrusted data). |
| Storage | `editor/draftStore.ts` | Never throws; a draft that no longer parses counts as none. |
| Controller | `core/EditorMode.ts` | Turns pointer and key input into edits, keeps renderer and panel in step, autosaves. |
| Panel | `ui/EditorPanel.ts` | Built in TypeScript from `index.html`'s `#editor` and `#editor-io`; reflects the draft through `sync`. |
| Wiring | `core/Game.ts` | `openEditor` / `closeEditor` / `playtest`; HUD mode (`EDITOR`, `PLAYTEST`) and a result panel that offers *Back to editor*. |

Decisions worth knowing:

- **The grid is the real `Grid`.** `TileLayer` already redraws through `grid.onChange`, so painting needs no
  renderer code. Only a *new* grid (resize, undo across a resize, import) needs `Renderer.setLevel`, and the
  hatch (which lives in the backdrop) needs the new `Renderer.setSpawn`.
- **The spawn is not a tile.** The map's `S` is Empty to the simulation, so the draft keeps `spawn`
  separately and enforces "its tile is Empty; painting anything over it removes it". `parseMap` was split
  out of `parseLevel` (null spawn allowed) so a half-drawn level can be saved and reloaded.
- **Brushes and export characters derive from `TileType` / `LEGEND`.** New tiles (steel, lava, ...) appear in
  the editor with no editor changes; `Level.test.ts` fails if one has no `LEGEND` character.
- **History is map snapshots**, not command objects: a level is at most 64×40 characters, so snapshots are
  simpler and cheap. Only the map is undoable; the name and numbers are ordinary form fields.
- **Keyboard.** `Input` now ignores keys aimed at form fields (otherwise typing "12" in a box would pick
  brushes, and Space would pause), blurs a focused field when the canvas is clicked, reads Ctrl/Cmd chords
  at keydown (a quick Ctrl+Z tap can end before the next frame), and suppresses the browser's own undo for
  Ctrl+Z/Y outside fields, which otherwise reached back into the last number box edited.
- **A playtest replaces the attempt in progress.** Visiting the editor does not (the session just freezes),
  but a playtest starts a new session; leaving it loads a fresh copy of the level it interrupted.

## Bugs found while building it

Both showed up only in the browser, and are fixed and covered by the checks below:

- Esc on the export box closed it *and* left the editor, because the keypress also reached the window-level
  handler. The box now stops the event.
- Chrome's undo stack is frame-wide: Ctrl+Z with nothing focused undid and refocused a number field edited
  earlier, which then committed a blank value on blur and shrank the map. See the keyboard note above.

## Tests

- `editor/LevelDraft.test.ts` (34 tests): painting, hatch rules, Bresenham strokes, flood fill, undo/redo
  (one step per stroke, in place on the same grid), resize, parameters, problems and warnings, export and
  import (every built-in level round-trips through `toSource` and `parseLevelText`), a drawn level that
  plays to a win and one that is lost, parsing, and storage including a store that throws.
- `world/Level.test.ts`: every tile type has a map character, and `parseMap` with and without a spawn.
- Checked end to end in Chromium (not committed; the repo has no browser test setup): opening from the
  level select and mid-game, typing in fields, drawing with real mouse input, fill, Ctrl+Z, playtest to a
  win with no progress recorded, back to the editor, reload persistence, export/import and its error
  path, copying a built-in level, and that the game, its tools and the result panel are intact after a visit.

## Not done / next

- Custom levels can't be played from the level select; adding one means pasting the export into `levels.ts`
  (and a solvability test). A "my levels" shelf, or sharing a level as a URL hash (next item in the backlog),
  would close that loop.
- No rectangle/line brush, selection/copy-paste, or pan/zoom for maps bigger than the screen (the canvas
  just scales down).
- The editor can't tell whether a level is *winnable*, only that it has a hatch and a goal. Playtest is the
  check; recording a playtest's inputs would pair well with the replay item in the backlog.
