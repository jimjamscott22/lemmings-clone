# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A Lemmings-style puzzle game in TypeScript on the raw HTML5 Canvas API (no game engine), built with Vite, with a Tailwind CSS v4 HUD.

## Commands

```bash
npm install
npm run dev          # Vite dev server, http://localhost:5173
npm test             # vitest run (all tests, headless)
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build

npx vitest run src/skills/skills.test.ts            # one test file
npx vitest run src/skills/skills.test.ts -t "Climber"  # tests whose describe/it name matches
```

There is no linter configured. `tsconfig.json` is strict, with `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports) and `isolatedModules`. Code stays erasable TS: no `enum`; use a `const` object plus a union type (see `TileType.ts`).

In dev, `window.game` and `window.progress` are exposed; `game.debug()` returns a snapshot of time, tallies, tool charges, each lemming's `state@col,row`, and the current level's saved record.

## Architecture

**Simulation vs. browser.** Everything under `world/`, `entities/`, `tools/`, `skills/`, `progress/` and `editor/` is DOM-free and runs headless in Vitest. Only `core/` (`Game`, `GameLoop`, `EditorMode`), `input/`, `render/` and `ui/` touch the browser. Keep it that way: new gameplay logic must be testable without a canvas.

**Loop and session.** `GameLoop` is a fixed-timestep loop (`FIXED_TIMESTEP` = 1/60 s, frame time capped by `MAX_FRAME_TIME`) so physics is deterministic. `Game` owns a `Session` (level, world, crowd, toolbox, outcome) that is rebuilt from the pristine `LevelData` on every load or restart; nothing is reset in place. Fast-forward runs `crowd.update` 3× per tick. Terrain editing, skill assignment and release-rate changes are handled even while paused, but input queues are always drained so nothing leaks into the next level or past the result screen.

**Lemming FSM.** `Lemming` holds only data (position is the centre-bottom of the feet, in canvas pixels; `col`, `bodyRow`, `groundRow`, `frontCol` derive tile coordinates). Behaviour lives in `entities/states/`, one file per state. States are stateless singletons implementing `LemmingState` (`enter?`, `update`); per-lemming data (timers, velocity, `stateTime`, skill flags) lives on `Lemming`. Transitions go through `lemming.setState(name, world)`, which looks up the `STATES` registry in `states/index.ts`, so state modules never import each other. Adding a state means: add it to the `StateName` union, create the file, and register it in `STATES`. Shared movement helpers are in `states/movement.ts`.

Before delegating to the current state, `Lemming.update` runs cross-cutting logic in order: bomber fuse countdown (`blast.ts`), escaping terrain that appeared inside the body (or being crushed), and tile triggers (Goal → `exiting`, Water → `swimming`).

**Crowd.** `Crowd` spawns lemmings from the hatch according to the release rate, updates them, removes finished ones, and keeps `saved`/`lost` tallies. A level is `finished` when all are released and none remain; if only blockers remain they are retired as lost. `World` (`{ grid, lemmings }`) is what states see; lemmings need the full list so walkers can detect blockers.

**Two player budgets.**
- *Terrain tools* (`tools/tools.ts`: dig, build) are applied to tiles via drag strokes; `Toolbox.stroke` fills gaps between pointer samples with Bresenham (`tilesOnLine`).
- *Skills* (`skills/skills.ts`: climber, floater, bomber, blocker, basher, miner) are assigned to one lemming by clicking. Permanent upgrades set flags on the lemming; jobs (`job(state)`) switch to a state and are only assignable from the `INTERRUPTIBLE` states.
- `tools/actions.ts` merges both into one `ActionId` list (`ACTION_ORDER`) that drives key bindings, the HUD toolbar and the `Toolbox.charges` record. Charges come from `LevelData.tools` / `LevelData.skills`.

**World and rendering.** `Grid` is a flat `Uint8Array` with listeners: always change tiles via `grid.set`, because `render/TileLayer` subscribes with `grid.onChange` to redraw its cached offscreen layer. Out of bounds, the left/right edges count as solid but top/bottom are open (falling off the bottom is death). Tile behaviour is data-driven by `TILE_PROPS` (`solid`, `diggable`, `hazard`, `animated`; animated tiles are redrawn every frame instead of cached). A new tile type needs a `TileType` entry, `TILE_PROPS`, a `LEGEND` character in `world/Level.ts`, and art in `render/tileArt.ts`.

**Saved progress.** `progress/Progress.ts` keeps per-level records (attempts, wins, best saved, fastest win), the level to resume, and settings (grid overlay) as versioned JSON under one `localStorage` key. It is DOM-free: it takes a `KeyValueStore` (`localStorage` in `main.ts`, a `Map`-backed fake in tests, or `null` for memory only) and never throws on storage errors or bad data; `sanitize` validates every field on load. Records are keyed by **level name**, so renaming a level orphans its progress (a test enforces unique names). Changing the `SaveData` shape means bumping `VERSION`; old saves are then discarded, so add a migration in `sanitize` if they should survive. `Game.checkOutcome` records each finished attempt (mid-level restarts don't count), and `Game.refreshProgress` updates the HUD's solved count and best display.

**Level select.** `ui/LevelSelect.ts` is a full-screen overlay inside `#viewport`, opened at launch, with `L`, and from the HUD and result panel. Unlocking is `Progress.isUnlocked`: level 0, any solved level, or the one after a solved level. Go through `Game.chooseLevel` (which enforces it) rather than `loadLevel` for player-initiated level changes. While it's open, `Game.update` returns early, so the simulation is frozen and only `Esc`/`L` are read; all other queued input is dropped. `Input` queues unconsumed key presses indefinitely, which is why opening the select calls `input.clearPresses()`.

**Level editor.** `E` opens it (`Game.openEditor`); `Game.update` hands the frame to `core/EditorMode.ts` while it's open, so the play session is frozen and untouched and `closeEditor` resumes it (the result panel included). The model is `editor/LevelDraft.ts`, DOM-free: a real `Grid` (so `TileLayer` redraws edits through `grid.onChange` exactly as in play), the spawn kept *beside* the grid (its tile is always Empty; painting any tile over it removes it), and the numeric `LevelData` fields as `FieldId`s listed in `DRAFT_FIELDS`. Resizing, undo across a resize and importing swap in a new `Grid`: `EditorMode.refresh` compares `draft.grid` with what the renderer shows and calls `Renderer.setLevel` when it changed. Undo history is map snapshots (ASCII rows with `S`); a drag stroke is one step. Brushes come from `TileType` plus the hatch, and the export character from `TILE_CHARS` (the inverse of `LEGEND`), so a new tile type shows up in the editor with no editor changes (a test fails if it lacks a `LEGEND` character). `toSource()` writes an object literal in the style of `levels.ts`, and `parseLevelText` (`editor/levelText.ts`) reads that back, plain JSON, or bare map rows; a test round-trips every built-in level. The draft autosaves under its own `localStorage` key via `editor/draftStore.ts`, separate from progress. **Playtest** (`Game.playtest`) runs the draft as an ordinary session with `playtestData` set: nothing is recorded in `Progress` (a draft's name may clash with a built-in level's), `R` restarts the playtest, and `E`/`Esc` returns to the editor. A playtest replaces the attempt in progress; leaving it drops back to a fresh copy of the real level. `Input` ignores keys aimed at `<input>`/`<textarea>`/`<select>` (so typing a name doesn't select brushes or pause), and reads Ctrl/Cmd chords (`consumeChord`) at keydown time.

**Sharing.** `editor/levelShare.ts` (DOM-free) packs a `LevelData` into `#level=<base64url>`: `version|name|key:value,...|map`, with the name URI-escaped, only non-default numbers written (keys are `FieldId`s), and map rows run-length encoded (`12.`, `row*4`). `decodeLevel` treats the link as hostile: caps on payload, width, height and run-count digits *before* anything is expanded, tiles checked against `LEGEND`, numbers clamped by going through `LevelDraft.setNumber`, and the level must pass `problems()` (hatch, goal, save target). Changing the format means bumping `FORMAT_VERSION` (old links then say they aren't understood). `main.ts` reads the hash at launch and on `hashchange`, clears it either way, and hands the level to `Game.playShared`, which is `Game.playtest(data, "link")`: the same session-without-progress as an editor playtest, told apart by `Game.trial` (`"editor"` or `"link"`) for the HUD banner, the result panel (`LevelResult.trial`: *Back to editor* vs *Edit a copy*) and where leaving the editor lands (a shared level restarts; a playtest drops to the real level). `parseLevelText` also accepts a pasted link.

**Tuning.** All physics and timing constants (tile size, gravity, speeds, dig/build/bash/mine times, splat height, bomb radius, release rate) are in `src/config.ts`. Units are canvas pixels and seconds.

## Levels and tests

Levels are ASCII maps in `src/world/levels.ts` (legend: `.` empty, `#` dirt, `X` wall, `~` water, `=` bridge, `G` goal, `S` spawn; all rows must be the same length) plus `LevelData` parameters (counts, release rate, bricks, tool and skill charges).

`src/world/levels.test.ts` proves each level is winnable by replaying a known solution with `play(index, strokes, cues)`: terrain strokes applied up front, then timed skill assignments via cues. When adding or changing a level, add or update its solvability test (and ideally a test that it is *not* winnable without help). A level must be able to end: a lemming that can never leave (e.g. a non-climber pacing before a wall) stops the crowd from finishing, so give enough skills for everyone or let them die.

Unit tests for states, skills and hazards use `src/test/sim.ts`: `setup(map)` builds a world from an ASCII map and places a lemming at `S`; `place` adds more lemmings; `run`/`runAll` step the simulation at the fixed timestep for N seconds or until a predicate holds.

## Docs

- `docs/features-to-add.md`: the feature backlog.
- `docs/plans/`: dated implementation plans for larger features.
- `graphify-out/GRAPH_REPORT.md`: a generated code-graph report (can be stale; it records the commit it was built from).
