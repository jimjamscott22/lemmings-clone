# Features to Add

## 1. Content: More Levels (Cheap, Big Payoff)

Two levels is the biggest gap. Levels are ASCII maps in `levels.ts`, and `levels.test.ts` already proves each one can be won, so new levels are mostly design work.

- ~~Add a level select screen with progress saved in `localStorage` (which levels are done, and your best saved count on each).~~ Done: a full-screen level select with levels unlocked in order, backed by `src/progress/Progress.ts`.
- Add difficulty ramps: a time limit, tighter tool charges, and higher save targets.

## 2. Classic Lemmings Skills Given to Individual Lemmings

Right now you change the terrain directly. The original game's main mechanic is clicking a lemming to give it a job. Your FSM registry would handle these well:

- **Blocker:** Stands still and turns others around.
- **Climber / Floater:** Permanent upgrades that let it climb walls or survive long falls.
- **Basher / Miner:** Digs sideways or diagonally.
- **Bomber:** A countdown, then it blows up nearby terrain.

You could keep both systems: terrain tools as a global budget and skills given per lemming.

## 3. New Tiles and Hazards

Each one is one entry in `TileType.ts` plus a legend character:

- **Steel:** Looks diggable but isn't, as a trap for the player.
- **One-way walls:** You can only dig them from one side.
- **Lava or spikes:** An instant hazard with no swimming.
- **Traps:** Crushers or fire jets on a timer.
- Teleporter pairs, conveyor belts, crumbling floor.

## 4. Game Feel

- Sound effects with the Web Audio API: the hatch opening, digging, a splash, a "yippee" at the exit.
- Particles for dirt debris, splashes, and a burst at the exit.
- A release-rate control (`+`/`-` to speed up or slow down spawning), as in the original.
- **Nuke:** Blow up all lemmings to end a hopeless run.
- Camera scroll and zoom for levels bigger than the screen.

## 5. Tooling

- An in-browser level editor that paints tiles and exports the ASCII map. You already have the drag-stroke and Bresenham code in `Toolbox.ts` to reuse.
- Replays: the simulation is DOM-free with a fixed timestep, so recording the inputs and the tick each one happened on gives deterministic replays almost for free.
- Share a level as a URL by encoding the ASCII map in the hash.

## My Recommendation

> Start with 5–8 more levels plus a level select screen, then add skills given to individual lemmings (Blocker and Basher first). More levels make the current mechanics worth playing, and skills are what make it feel like Lemmings rather than a sandbox. If you'd rather build the level editor first, it would make producing those levels much faster.