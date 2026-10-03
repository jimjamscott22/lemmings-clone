# Graph Report - lemmings-clone  (2026-10-03)

## Corpus Check
- 54 files · ~17,712 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 351 nodes · 918 edges · 14 communities
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec7cd191`
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
- TilePoint
- GameLoop
- Lemmings.ts
- Lemming
- Features to Add
- Plan: Skills given to individual lemmings

## God Nodes (most connected - your core abstractions)
1. `Lemming` - 40 edges
2. `Grid` - 26 edges
3. `World` - 24 edges
4. `TileType` - 21 edges
5. `TILE_SIZE` - 20 edges
6. `Crowd` - 20 edges
7. `Game` - 19 edges
8. `LemmingState` - 18 edges
9. `TilePoint` - 17 edges
10. `Toolbox` - 16 edges

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
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/falling.ts -> src/entities/Lemming.ts`
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/swimming.ts -> src/entities/Lemming.ts`
- 3-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/walking.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/falling.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/bashing.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/bashing.ts -> src/entities/states/movement.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/blocking.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/building.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/climbing.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/climbing.ts -> src/entities/states/movement.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/digging.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/exiting.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/jumping.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/mining.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/splatting.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/swimming.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/swimming.ts -> src/entities/states/movement.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/walking.ts -> src/entities/states/LemmingState.ts -> src/entities/Lemming.ts`
- 4-file cycle: `src/entities/Lemming.ts -> src/entities/states/index.ts -> src/entities/states/walking.ts -> src/entities/states/movement.ts -> src/entities/Lemming.ts`

## Communities (14 total, 0 thin omitted)

### Community 0 - "config.ts"
Cohesion: 0.08
Nodes (52): BASH_TIME, BLOCKER_REACH, BOMB_RADIUS, BUILD_TIME, CLIMB_SPEED, DIG_TIME, DROWN_TIME, EXIT_TIME (+44 more)

### Community 1 - "Game.ts"
Cohesion: 0.08
Nodes (27): BOMB_FUSE, RELEASE_RATE_HOLD_SPEED, RATE_DOWN_KEYS, RATE_UP_KEYS, Session, canvas, game, INTERRUPTIBLE (+19 more)

### Community 2 - "Grid"
Cohesion: 0.10
Nodes (18): isHard(), PALETTE, TILE_SWATCH, drawAnimatedTile(), drawBridge(), drawDirt(), drawGoal(), drawStaticTile() (+10 more)

### Community 3 - "Game"
Cohesion: 0.17
Nodes (4): Game, byId(), LevelResult, ResultOverlay

### Community 4 - "compilerOptions"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2022, src, vite/client, vite.config.ts, compilerOptions, isolatedModules (+14 more)

### Community 5 - "package.json"
Cohesion: 0.09
Nodes (21): devDependencies, tailwindcss, @tailwindcss/vite, typescript, vite, vitest, name, private (+13 more)

### Community 6 - "Crowd.ts"
Cohesion: 0.12
Nodes (19): FIXED_TIMESTEP, RELEASE_RATE_DEFAULT, RELEASE_RATE_MAX, RELEASE_RATE_MIN, RELEASE_RATE_STEP, SPAWN_INTERVAL, TILE_SIZE, clampRate() (+11 more)

### Community 7 - "TilePoint"
Cohesion: 0.15
Nodes (4): Input, Renderer, RenderState, TilePoint

### Community 8 - "GameLoop"
Cohesion: 0.22
Nodes (3): MAX_FRAME_TIME, GameLoop, LoopCallbacks

### Community 9 - "Lemmings.ts"
Cohesion: 0.29
Nodes (6): Architecture, Controls, How lemmings behave, Lemmings.ts, Running it, Skills

### Community 11 - "Lemming"
Cohesion: 0.17
Nodes (6): blast(), Lemming, toTile(), World, job(), TestWorld

### Community 12 - "Features to Add"
Cohesion: 0.25
Nodes (7): 1. Content: More Levels (Cheap, Big Payoff), 2. Classic Lemmings Skills Given to Individual Lemmings, 3. New Tiles and Hazards, 4. Game Feel, 5. Tooling, Features to Add, My Recommendation

### Community 13 - "Plan: Skills given to individual lemmings"
Cohesion: 0.33
Nodes (5): Design decisions, Implementation steps, Plan: Skills given to individual lemmings, Skill rules, Verification

## Knowledge Gaps
- **59 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+54 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Lemming` connect `Lemming` to `config.ts`, `Game.ts`, `Grid`, `Game`, `Crowd.ts`, `TilePoint`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `Grid` connect `Grid` to `config.ts`, `Game.ts`, `Lemming`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `Game` connect `Game` to `GameLoop`, `Game.ts`, `TilePoint`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _59 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07550860719874804 - nodes in this community are weakly interconnected._
- **Should `Game.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Grid` be split into smaller, more focused modules?**
  _Cohesion score 0.10338164251207729 - nodes in this community are weakly interconnected._