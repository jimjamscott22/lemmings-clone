# Lemmings.ts

A lightweight Lemmings-style puzzle game in TypeScript and the HTML5 Canvas API, with no game engine, and a Tailwind CSS HUD.

Lemmings drop from a hatch and walk on their own. Shape the terrain in real time, and give individual lemmings jobs, so that enough of them reach the exit before they drown, splat, or fall into the void.

<p align="center">
  <img src="docs/screenshot.jpg" alt="Level 3, Lend a Hand: a blocker holds the crowd on a stone ledge while a miner digs a staircase down a dirt mesa toward the exit" width="800">
</p>

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: physics, state machine, tools, level solvability
npm run build      # typecheck + production build
```

## Controls

| Input | Action |
| --- | --- |
| Click and drag | With a terrain tool selected: use it on every tile you sweep over |
| Click a lemming | With a skill selected: give it that skill (the target is outlined green if it can take it) |
| `1` / `2` | Select terrain tool **Dig** (remove dirt or bridge) / **Build** (place a bridge in open air) |
| `3`–`8` | Select skill **Climber**, **Floater**, **Bomber**, **Blocker**, **Basher**, **Miner** |
| `−` / `+` | Slow down / speed up the release rate (1–99; hold to change quickly, or use the HUD buttons) |
| `Space` | Pause (you can still edit terrain, give skills and change the release rate while paused) |
| `F` | Fast-forward ×3 |
| `R` | Restart the level |
| `N` | Next level (after a win) |
| `G` | Toggle grid overlay |
| `L` | Open the level select (`Esc` or `L` closes it) |

Each tool and skill has limited charges per level, shown in the toolbar.

## Progress

The game opens on a level select screen. Levels unlock in order: the first is open, and solving a level unlocks the next. Each card shows whether the level is solved, your best saved count and fastest win, and how many attempts and wins you've had. The simulation is frozen while the level select is open.

Progress is saved in your browser's `localStorage`: the per-level records, the level you last played (the level select starts with it highlighted, so `Enter` resumes it), and whether the grid overlay is on. The HUD shows how many levels you've solved and your best on the current level. The end-of-level panel calls out a first clear or a new best. **reset progress** on the level select clears it all and locks every level but the first.

## Skills

Terrain tools are a global budget you spend on tiles. Skills are a second budget you spend on one lemming at a time:

| Skill | Effect |
| --- | --- |
| **Climber** | Permanent. Climbs walls instead of turning around; lets go and falls back under an overhang. |
| **Floater** | Permanent. Opens an umbrella and survives any fall (but not the void). |
| **Bomber** | Counts down 5 seconds, then explodes, blasting diggable terrain within 1.5 tiles. Reaching the exit defuses it. |
| **Blocker** | Stands still for good and turns other walkers around. Bomb it to free its spot. |
| **Basher** | Tunnels horizontally through dirt and bridge, including one-tile steps a walker would jump. |
| **Miner** | Digs a staircase diagonally down and forward until it breaks through or hits a wall. |

Falls of more than 9 tiles are fatal. If only blockers are left, the level ends and they count as lost.

## How lemmings behave

Each lemming runs a finite state machine (`src/entities/states/`):

| State | Behaviour |
| --- | --- |
| **Falling** | Gravity with terminal velocity; lands on the first solid tile top; lost if it drops off the bottom of the map. |
| **Walking** | Walks forward and falls off ledges. When blocked, it **jumps** a one-tile step, **digs** through dirt, **builds** if the obstacle is taller and it has bricks, or otherwise turns around. |
| **Jumping** | A ballistic arc that clears one tile, with wall and ceiling collision. |
| **Digging** | Spends `DIG_TIME` tunnelling through the dirt tile ahead. |
| **Building** | Lays a bridge block underfoot and climbs onto it, one brick per block. Stacks left behind become stairs for later lemmings. |
| **Swimming** | Floats at the surface and paddles. If it reaches a low bank it climbs out; otherwise it tires and drowns. |
| **Exiting** | Reached the goal, so it counts as saved. |
| **Splatting** | Landed from more than 9 tiles up without an umbrella, so it's lost. |
| **Climbing**, **Blocking**, **Bashing**, **Mining** | Jobs given by skills (see above). Walkers also climb instead of turning if they're climbers. |

A level ends when every lemming is saved or lost. You win if you saved at least the required number.

## Architecture

```
src/
├── config.ts             Tile size, timestep, and all physics/timing constants
├── core/                 GameLoop (fixed 60 Hz timestep) and Game (sessions, input, outcome)
├── entities/             Lemming (data), Crowd (spawner + tally), World, and states/ (one file per FSM state)
├── tools/                Tool definitions, the combined tool + skill action list, and Toolbox (charges, drag strokes, skill assignment)
├── skills/               Skill definitions: who can take each skill and what it does
├── world/                Grid, TileType properties, ASCII level parser, and level data
├── render/               Canvas renderer, cached tile layer, tile and lemming pixel art
├── input/                Pointer and keyboard; drag samples are queued so fast strokes aren't missed
├── progress/             Saved progress (solved levels, bests, resume point, settings) over a pluggable key-value store
└── ui/                   Tailwind HUD and the end-of-level overlay
```

- **States are stateless singletons.** Per-lemming data lives on `Lemming`. Transitions go through a name-keyed registry, so state modules never import each other.
- **The simulation is DOM-free.** `Grid`, `Lemming`, `Crowd` and `Toolbox` run headless in Vitest. `levels.test.ts` plays each level with a known solution (terrain strokes and timed skill assignments) to prove it can be won.
- **Levels are ASCII maps** in `src/world/levels.ts`. The legend: `.` empty, `#` dirt, `X` wall, `~` water, `=` bridge, `G` goal, `S` spawn.
