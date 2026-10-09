# Features to Add

Updated October 9, 2026. Implementation status checked against the current workspace source and README. This is a feature inventory and proposed backlog, not a record of browser testing or deployed behavior.

## 1. Currently Implemented

### Levels and Progress

- **Eight built-in levels:** Just Dig It, Mind the Gap, Lend a Hand, Turn Back, Parachute Drop, Over the Wall, Down the Mine, and Grand Tour. Later levels introduce individual skills and then combine them.
- **Level select:** Levels unlock in order, with completed levels and personal records shown on their cards.
- **Saved progress:** `localStorage` stores best saved count, fastest win, completed attempts, wins, the last selected level, and grid/sound preferences. Restarting midway does not count as a completed attempt. The last selected level is remembered; an unfinished run is not restored.
- **Level parameters:** Save targets, terrain-tool charges, skill charges, starting release rate, and per-lemming building bricks are configurable. Optional time limits are implemented, including an editor field, HUD countdown, timeout result, and save/share support.
- **Difficulty ramp:** Levels 1–3 stay untimed; levels 4–8 have 90/75/65/55/60-second limits. Later levels require more rescues and provide fewer spare tool or skill charges. Pause and menus freeze the timer; fast-forward speeds it up. At expiry, those already entering the exit are saved and everyone else is lost.
- **Solvability coverage:** `src/world/levels.test.ts` contains known solutions for the built-in levels and checks them within their deadlines.

### Tools, Skills, and Run Controls

- **Terrain tools:** Dig removes dirt or bridge; Build places bridge tiles. Drag strokes fill gaps between pointer samples.
- **Six individual skills:** Blocker turns walkers around; Climber and Floater are permanent upgrades; Basher tunnels sideways; Miner digs diagonally; Bomber explodes after a five-second fuse.
- **Automatic behavior:** Walking, jumping small steps, digging, building with available bricks, swimming, and exiting. Long falls, drowning, and falling off the map can kill lemmings.
- **Release-rate control:** `−` / `+` and HUD buttons adjust spawning from 1–99, with hold-to-repeat.
- **Run controls:** Pause, ×3 fast-forward, restart, next level after a win, and a grid overlay. Terrain edits, skill assignments, and release-rate changes work while paused.
- **Nuke:** Press `K` twice within three seconds, or use the HUD button, to stop spawning and light every active lemming's bomber fuse. Lemmings can still reach the exit before exploding.

### Help and Game Feel

- **How to play guide:** Open with `H` or the UI buttons. Covers behavior, tools, skills, hazards, tactics, controls, progress, and the editor. Opening it freezes gameplay; closing it returns to the previous screen and pause state.
- **Sound:** Synthesized hatch, digging, and splash effects; a spoken “Yippie!” at the exit with a celebratory tone fallback. The Sound toggle persists between visits.
- **Visual feedback:** Animated lemmings, water and goals, plus valid/invalid terrain and skill-target highlights. The canvas scales to fit the viewport; interactive camera pan and zoom are not implemented.

### Editor and Sharing

- **In-browser editor:** Pencil, flood fill, undo/redo, resize, hatch placement, level parameters, validation, built-in level templates, and a blank-map starting point.
- **Draft workflow:** Browser autosave, playtesting, and export/import as level source, JSON, or plain map rows. Custom playtests do not change campaign progress.
- **Share by URL:** Compressed `#level=` links contain the level without a server. Shared levels can be played, restarted, and copied into the editor. Imported links are validated before use.

Main implementation references: `src/world/levels.ts`, `src/world/TileType.ts`, `src/skills/skills.ts`, `src/core/Game.ts`, `src/progress/Progress.ts`, `src/ui/HelpGuide.ts`, `src/audio/GameAudio.ts`, and `src/editor/`.

## 2. Recommended Next Features

These are proposals, not implemented features. Effort is relative: **Small** uses existing systems, **Medium** crosses several systems, and **Large** introduces substantial simulation or persistence work.

| Priority | Feature | First useful version | Why add it? | Effort |
| --- | --- | --- | --- | --- |
| 1 | **Challenge level pack** | Add 4–6 levels using the existing skills, with tighter budgets, higher save targets, and a known solution for each. | Gives players more to do with mechanics already built. | Small–Medium |
| 2 | **Better crowd targeting** | Let players cycle overlapping lemmings and filter by facing direction; keep the chosen target clearly highlighted. | Makes precise skill assignment easier in a crowded area. | Medium |
| 3 | **Spikes or lava** | Add one clearly marked instant-death tile, editor support, and two levels that teach it. | Adds a new routing constraint beyond water and fatal falls. | Medium |
| 4 | **Challenge medals** | Add optional save-all, limited-tool, or speed targets, with persistent badges on level cards. | Encourages replay without making the basic win condition harder. | Medium |
| 5 | **Custom-level library** | Save multiple named drafts locally, duplicate them, and export/import a collection. Keep custom records separate from campaign progress. | Makes the existing editor and sharing workflow useful beyond a single draft. | Medium |
| 6 | **Particles and clearer feedback** | Dirt debris, splashes, exit bursts, and a brief explanation when a skill cannot be assigned; include reduced-effects settings. | Makes actions and mistakes easier to read. | Small–Medium |

## 3. Larger Follow-ups

- **One-way diggable terrain:** Allow tunneling only in the indicated direction. Define how Dig, Basher, Miner, and explosions interact with it, and use clear directional artwork.
- **Timed traps and moving terrain:** Crushers, fire jets, conveyors, or crumbling floors. Start with one mechanic and introduce it in dedicated levels before combining several.
- **Camera pan and zoom:** Make larger maps practical, with matching pointer coordinates for gameplay and the editor. Add a minimap only if navigation needs it.
- **Replay recording and playback:** Record ordered simulation actions, including terrain strokes, skill targets, release-rate changes, and nukes. Store the level and simulation version, and verify playback against the original outcome. The fixed timestep helps, but paused inputs and fast-forward need explicit handling.
- **Rewind or checkpoints:** Let players recover from a bad assignment. This needs restorable terrain, lemming states, timers, charges, spawn state, and outcomes; it is a separate feature from replay playback.
- **Mobile and accessibility improvements:** Larger touch targets, a way to inspect a skill target before assigning it, remappable shortcuts, and high-contrast indicators that do not rely on color alone.

## 4. Implementation Notes

- **Indestructible terrain already exists:** `Wall` (`X`) is solid and non-diggable. A separate Steel tile needs a distinct purpose; otherwise, clearer wall artwork is enough. Make indestructible terrain recognizable rather than disguising it as dirt.
- **New hazards need behavior as well as a tile entry:** Add tile properties, an ASCII legend character, artwork, simulation rules, and coverage for tool/skill interactions. The editor derives its brushes from tile definitions, but import/export and shared-level validation still need checking.
- **Protect existing progress and shared links:** Progress currently uses level names as keys. Stable level IDs and a migration would make renaming levels safer. New level fields or replay formats need deliberate compatibility handling.
- **Use existing tests as the foundation:** Add known solutions for new levels and focused coverage for new interactions. Documentation status alone does not prove a level is playable.

## My Recommendation

Start with **a challenge level pack and better crowd targeting**, then add **one new hazard with a small teaching pack**. Follow with medals and a custom-level library. This adds playable content, improves the most precise interaction, and gives players a reason to return. Replays, rewind, and moving-world mechanics are valuable later, once their larger implementation cost is justified.
