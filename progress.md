Original prompt: Add an in-game documentation section that thoroughly explains game mechanics, every lemming skill, and how to use them, accessible in the UI or start screen.

- Approved design: a scrollable How to play guide on the level select and top bar, freezing gameplay without changing the player's pause state.
- Implemented How to play entry points on level select and the top bar, plus H from play, menus, and editor.
- Added a native modal with section navigation, responsive skill cards, keyboard focus wrapping, Escape/Close, and synchronous input cleanup. It freezes the simulation and preserves the underlying screen and pause state.
- Documented automatic behavior, tool/personal-brick budgets, all six skills and assignment restrictions, hazards, rescue examples, controls, Nuke, progress, editor, and sharing. Corrected the README's Blocker release instructions.
- Validation: production build and git diff --check passed. All 156 existing tests across 13 files passed sequentially with TEMP/TMP pointing to node_modules/.cache/guide-temp. Happy DOM prints a pre-existing Google Fonts fetch-abort message during teardown.
- Browser validation: Playwright on installed Edge passed start/top-bar/H access, frozen state, resumed and preserved pause states, blocked game shortcuts, focus trap/return, section navigation without changing URL hash, editor/shared/result return, and fit at 1440px, 390px, 320px, and 844px landscape. Screenshots were visually inspected. The existing favicon 404 was suppressed in the focused browser checks; no application console errors occurred.
- Validation scripts and screenshots saved outside the repository under the thread visualization folder's game-guide-validation directory. The bundled web-game client was also run using installed Edge and the existing debug snapshot.
- No outstanding implementation tasks. No commit or push requested.

## Sound effects (approved follow-up)

- Request: hatch, digging, splash, and the essential spoken “Yippie!” at the exit. Approved: Web Audio effects, high-pitched browser speech with a chirp fallback, saved mute, gesture unlock, bounded overlap, and stopping sounds on pause/menu/restart.
- Added browser-only GameAudio and optional simulation events. Hatch emits once per attempt; digging emits only on successful removal (automatic digging, Basher, Miner, and the player Dig tool); water and goal entry emit splash and exit events.
- Added the top-bar Sound on/off toggle to saved progress, defaulting old saves to enabled without changing their records. Updated the in-game guide, README, and feature list.
- Browser voice loading is warmed up at startup so the first rescue can speak. English local voices are preferred; missing voices and speech failures use the two-note chirp. Only one utterance is active, and synthesized effects have cooldowns and a maximum of eight sources.
- Validation: production build and git diff --check passed; 161 tests in 14 files passed sequentially with the local temp folder. Added event-count and legacy-save regression coverage. Existing Happy DOM Google Fonts teardown output remains.
- Real Edge/Playwright checks: AudioContext unlock and a non-zero audio waveform, all event triggers including the terrain tool/Basher/Miner, actual native “Yippie!” start and end callbacks, controlled speech/error/cancel/queue cases, chirp fallback, bounded bursts, pause/menu/restart silence, mute persistence, and mobile/desktop UI. No application console errors. The guide's earlier browser checks also still pass.
- Visually inspected desktop/mobile screenshots and the bundled web-game client's gameplay capture. Validation scripts, JSON evidence, and screenshots are under the thread visualization folder's sound-validation directory, outside the repository.
- No outstanding work. No commit or push requested. Preserved the earlier guide changes and unrelated .graphify files.
