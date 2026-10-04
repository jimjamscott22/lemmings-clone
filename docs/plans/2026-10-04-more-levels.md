# Plan: Levels 4–8

Goal: close the "two levels is the biggest gap" item in `features-to-add.md`. Skills and the level select
already exist, so the new levels teach the skills one at a time and finish with a level that combines them.
No new mechanics: every level uses the existing tiles, tools and skills.

## The levels

| # | Name | Teaches | What stops the crowd | Budget | Save |
| --- | --- | --- | --- | --- | --- |
| 4 | Turn Back | Blocker | A cliff at the end of the platform. A blocker near the edge sends everyone back to the real way down. | blocker 1 | 8 of 10 |
| 5 | Parachute Drop | Floater | A 13-tile drop (fatal past 9), then a chasm to bridge. | floater 6, build 8 | 5 of 8 |
| 6 | Over the Wall | Climber | An indestructible 7-tile wall, then a chasm. | climber 6, build 6 | 5 of 6 |
| 7 | Down the Mine | Miner | A penned crowd on a dirt mass, exit in a cavern below. An indestructible slab sits across the diagonal near the start, so the miner has to begin beyond it. | miner 2 | 8 of 10 |
| 8 | Grand Tour | Everything but blocker | Climb a wall, bash a 3-thick bridge barricade (2 dig charges can't tunnel it), bridge a pool. | climber 8, basher 1, dig 2, build 8 | 6 of 8 |

Design rules these follow:

- **A level must be able to end.** A lemming that can never get out (a non-climber pacing in front of a
  wall) keeps the crowd from finishing and there is no nuke yet. Levels 6 and 8 therefore give one Climber
  per lemming. Blockers are fine, since `Crowd` retires them once everyone else is gone.
- **Each skill is required, not just allowed.** Every level has a test that it is lost without the skill
  (and without the terrain tool, where it needs one), so a lesson can't be skipped.
- **Teaching levels have slack.** Required counts leave room for a lemming or two lost to a mistake.

## Bug found while building them

`Lemming.fallStartY` defaulted to 0 and nothing runs the falling state's `enter` for a fresh spawn, so a
lemming that spawned more than `SPLAT_HEIGHT` (9 tiles) below the top of the map was measured as having
fallen from y = 0 and splatted on its first landing. Levels 1–3 all spawn near the top, so it never showed.
It would also have opened a floater's umbrella at once. The constructor now starts `fallStartY` at the
spawn height, with a regression test in `Crowd.test.ts`.

## Tests

`levels.test.ts` gets, per new level, a "winnable" test replaying a known solution and one or more "lost
without X" tests (see CLAUDE.md for the `play(index, strokes, cues)` helper). The `times(n, cue)` helper
hands out the same skill to several lemmings in turn.

## Not done / next

- Difficulty ramps (time limit, tighter charges, higher save targets) are still open in the backlog.
- A nuke would let a level end even when lemmings are stuck, and would relax the one-climber-per-lemming rule.
- Level 7 doesn't need the Blocker or Bomber; a later level could use them together (hold the crowd, then
  bomb the blocker free), as level 3 does.
- Next in the recommendation: a level editor (makes more levels cheap), or the new tiles and hazards (steel,
  one-way walls, lava).
