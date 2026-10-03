# Plan: Skills given to individual lemmings

Goal: add the classic per-lemming jobs (Climber, Floater, Bomber, Blocker, Basher, Miner) alongside the
existing terrain tools. Terrain tools stay a global budget you drag over tiles; skills are a second budget
you spend by clicking a lemming.

## Design decisions

- **One toolbar, two kinds of action.** `ActionId = ToolId | SkillId`. Keys `1`–`2` stay Dig/Build;
  `3`–`8` select Climber, Floater, Bomber, Blocker, Basher, Miner. With a terrain tool selected,
  click-and-drag edits tiles (unchanged). With a skill selected, a click assigns it to the lemming under
  the pointer, and hovering highlights the target (green if it can take the skill, red if not).
- **Charges per level.** `LevelData.skills?: Partial<Record<SkillId, number>>`, defaulting to 0.
  `Toolbox` keeps charges for both kinds.
- **Permanent upgrades are flags on `Lemming`** (`climber`, `floater`); the bomber fuse is
  `fuse: number | null`, ticked in `Lemming.update`. **Jobs are new FSM states** registered in `STATES`:
  `climbing`, `blocking`, `bashing`, `mining`, plus `splatting` (death animation for long falls).
- **Fall damage.** Floaters need something to survive, so falling more than `SPLAT_HEIGHT`
  (9 tiles) kills a lemming. Levels 1–2 have no survivable fall over 8 tiles, so they're unaffected
  (the level tests confirm this). Floaters open an umbrella after one tile and fall at `FLOAT_SPEED`.
- **Blockers need to see other lemmings**, so `World` gains `lemmings: readonly Lemming[]`. A walker
  heading toward a blocker in the same row turns around when it gets within `BLOCKER_REACH`.
- **A level can't soft-lock on blockers.** Once everyone is released and only blockers remain, they
  count as lost and the level ends. (Bomb a blocker to free its spot first, as in the original.)

### Skill rules

| Skill | Can assign when | Effect |
| --- | --- | --- |
| Climber | Not already a climber; alive | Permanent. A walker blocked by a wall (not a one-tile step) climbs it instead of digging or turning. Hitting a ceiling makes it let go and fall back. |
| Floater | Not already a floater; alive | Permanent. Falls slowly with an umbrella and never splats. The void still kills. |
| Bomber | No fuse yet; alive | 5-second countdown shown above the head, then it explodes, clearing diggable tiles within 1.5 tiles. Counts as lost. Exiting stops the fuse. |
| Blocker | Walking or working on the ground | Stands still forever; walkers turn around at it. Falls if its ground is removed. |
| Basher | Walking or working on the ground, not already bashing | Walks on, then tunnels horizontally through every diggable tile (dirt *and* bridge, and it won't jump one-tile steps). Stops when the tunnel breaks through or it hits wall. |
| Miner | Walking or working on the ground, not already mining | Digs a diagonal staircase down-forward, one tile per `MINE_TIME`. Stops on hitting wall; falls if it breaks out into open air. |

Note: walkers already auto-dig dirt, so the Basher's distinct value is bashing bridge, cutting through
one-tile steps instead of jumping them, and being faster. Worth revisiting if auto-dig is ever removed.

## Implementation steps

1. **Config & data** — new constants in `config.ts`; `skills` field on `LevelData`; `World.lemmings`;
   new `Lemming` fields (`climber`, `floater`, `fuse`, `fallStartY`) and a `frontCol` getter.
2. **States** — `climbing`, `blocking`, `bashing`, `mining`, `splatting`; shared `walkStep` helper in
   `states/movement.ts` (walking and bashing both use it, including the blocker check); falling
   gets the floater cap and splat check; walking's decision table gains "climber → climb".
3. **Bomber** — fuse countdown and `blast()` in `entities/blast.ts`.
4. **Skills module** — `src/skills/skills.ts`: `SkillId`, `Skill` (`canAssign`, `assign`), `SKILLS`,
   `SKILL_ORDER`. `src/tools/actions.ts`: `ActionId`, `ACTION_ORDER`, `actionInfo`, `isSkill`.
5. **Toolbox & Crowd** — Toolbox tracks all charges, `canAssign` / `assign`; strokes are ignored while a
   skill is selected. `Crowd.lemmingAt(point, prefer)` hit-tests lemmings. Crowd retires stranded blockers.
6. **Input & Game** — Input queues click positions in canvas pixels; Game routes clicks to skill
   assignment, passes hover info to the renderer, and selects actions by key.
7. **Rendering & HUD** — poses for the new states, umbrella, countdown digits (3×5 bitmap font), and the
   hover highlight; toolbar shows all 8 actions with a divider; footer hints updated.
8. **Level 3 "Lend a Hand"** — skills only. Miner out of the start pen, Basher through a wooden barricade,
   then a Blocker, a Miner down a 12-tile mesa, and a Bomber to free the crowd. Climbers and floaters
   give alternative routes.
9. **Tests** — unit tests per skill (climb over a wall, let go at a ceiling, float vs. splat, bomb
   crater, blocker turns walkers around, bash through bridge, mine a staircase, assignment rules,
   charges, hit-testing, stranded blockers end the level); a level 3 solvability test; existing tests
   updated for `World.lemmings`.
10. **Docs** — README controls, states, and skills.

## Verification

`npm test`, `npm run build`, and a manual browser check if the Chrome extension is available.
