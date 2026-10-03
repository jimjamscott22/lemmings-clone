# Graph Report - lemmings-clone  (2026-10-02)

## Corpus Check
- 42 files · ~11,462 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 276 nodes · 674 edges · 11 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f534638`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- config.ts
- Game.ts
- Grid
- Game
- compilerOptions
- package.json
- Crowd.ts
- Renderer.ts
- GameLoop
- Lemmings.ts

## God Nodes (most connected - your core abstractions)
1. `Lemming` - 24 edges
2. `Grid` - 23 edges
3. `Game` - 19 edges
4. `TilePoint` - 17 edges
5. `TileType` - 17 edges
6. `TILE_SIZE` - 16 edges
7. `Crowd` - 16 edges
8. `World` - 16 edges
9. `compilerOptions` - 15 edges
10. `Hud` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Session` --references--> `Crowd`  [EXTRACTED]
  src/core/Game.ts → src/entities/Crowd.ts
- `Session` --references--> `World`  [EXTRACTED]
  src/core/Game.ts → src/entities/World.ts
- `Game` --references--> `GameLoop`  [EXTRACTED]
  src/core/Game.ts → src/core/GameLoop.ts
- `Game` --references--> `Input`  [EXTRACTED]
  src/core/Game.ts → src/input/Input.ts
- `Game` --references--> `Renderer`  [EXTRACTED]
  src/core/Game.ts → src/render/Renderer.ts

## Import Cycles
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/digging.ts -> src/entities/Lemming.ts`
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/swimming.ts -> src/entities/Lemming.ts`
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/walking.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/jumping.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/building.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/digging.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/exiting.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/falling.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/swimming.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/walking.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`

## Communities (11 total, 0 thin omitted)

### Community 0 - "config.ts"
Cohesion: 0.10
Nodes (30): BUILD_TIME, DIG_TIME, DROWN_TIME, FLOAT_DEPTH, GRAVITY, JUMP_FORWARD_SPEED, JUMP_SPEED, LEMMING_HALF_WIDTH (+22 more)

### Community 1 - "Game.ts"
Cohesion: 0.10
Nodes (21): RELEASE_RATE_HOLD_SPEED, TILE_SIZE, RATE_DOWN_KEYS, RATE_UP_KEYS, Session, Input, canvas, game (+13 more)

### Community 2 - "Grid"
Cohesion: 0.12
Nodes (16): drawAnimatedTile(), drawBridge(), drawDirt(), drawGoal(), drawStaticTile(), drawWall(), drawWater(), TileLayer (+8 more)

### Community 3 - "Game"
Cohesion: 0.10
Nodes (6): Game, ToolId, byId(), Hud, LevelResult, ResultOverlay

### Community 4 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2022, src, vite/client, vite.config.ts, compilerOptions, isolatedModules (+14 more)

### Community 5 - "package.json"
Cohesion: 0.09
Nodes (21): devDependencies, tailwindcss, @tailwindcss/vite, typescript, vite, vitest, name, private (+13 more)

### Community 6 - "Crowd.ts"
Cohesion: 0.15
Nodes (10): RELEASE_RATE_DEFAULT, RELEASE_RATE_MAX, RELEASE_RATE_MIN, RELEASE_RATE_STEP, SPAWN_INTERVAL, clampRate(), Crowd, releaseInterval() (+2 more)

### Community 7 - "Renderer.ts"
Cohesion: 0.17
Nodes (9): EXIT_TIME, isDrowning(), drawBody(), drawLemming(), RectFn, PALETTE, TILE_SWATCH, Renderer (+1 more)

### Community 8 - "GameLoop"
Cohesion: 0.20
Nodes (4): FIXED_TIMESTEP, MAX_FRAME_TIME, GameLoop, LoopCallbacks

### Community 9 - "Lemmings.ts"
Cohesion: 0.33
Nodes (5): Architecture, Controls, How lemmings behave, Lemmings.ts, Running it

## Knowledge Gaps
- **47 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Game` connect `Game` to `GameLoop`, `Game.ts`, `Renderer.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `Grid` connect `Grid` to `config.ts`, `Game.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `Hud` connect `Game` to `Game.ts`, `Grid`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10412299091544375 - nodes in this community are weakly interconnected._
- **Should `Game.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10202020202020202 - nodes in this community are weakly interconnected._
- **Should `Grid` be split into smaller, more focused modules?**
  _Cohesion score 0.11794871794871795 - nodes in this community are weakly interconnected._