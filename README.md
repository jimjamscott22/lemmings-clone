# Lemmings.ts

A lightweight Lemmings-style puzzle game in TypeScript and the HTML5 Canvas API, with no game engine, and a Tailwind CSS HUD.

Lemmings drop from a hatch and walk on their own. Shape the terrain in real time so that enough of them reach the exit before they drown or fall into the void.

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
| Click and drag | Use the selected tool on every tile you sweep over |
| `1` / `2` | Select **Dig** (remove dirt or bridge) / **Build** (place a bridge in open air) |
| `−` / `+` | Slow down / speed up the release rate (1–99; hold to change quickly, or use the HUD buttons) |
| `Space` | Pause (you can still edit terrain and the release rate while paused) |
| `F` | Fast-forward ×3 |
| `R` | Restart the level |
| `N` | Next level (after a win) |
| `G` | Toggle grid overlay |

Each tool has limited charges per level, shown in the toolbar.

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

A level ends when every lemming is saved or lost. You win if you saved at least the required number.

## Architecture

```
src/
├── config.ts             Tile size, timestep, and all physics/timing constants
├── core/                 GameLoop (fixed 60 Hz timestep) and Game (sessions, input, outcome)
├── entities/             Lemming (data), Crowd (spawner + tally), World, and states/ (one file per FSM state)
├── tools/                Tool definitions and Toolbox (charges, drag strokes, Bresenham fill)
├── world/                Grid, TileType properties, ASCII level parser, and level data
├── render/               Canvas renderer, cached tile layer, tile and lemming pixel art
├── input/                Pointer and keyboard; drag samples are queued so fast strokes aren't missed
└── ui/                   Tailwind HUD and the end-of-level overlay
```

- **States are stateless singletons.** Per-lemming data lives on `Lemming`. Transitions go through a name-keyed registry, so state modules never import each other.
- **The simulation is DOM-free.** `Grid`, `Lemming`, `Crowd` and `Toolbox` run headless in Vitest. `levels.test.ts` plays each level with a known solution to prove it can be won.
- **Levels are ASCII maps** in `src/world/levels.ts`. The legend: `.` empty, `#` dirt, `X` wall, `~` water, `=` bridge, `G` goal, `S` spawn.
