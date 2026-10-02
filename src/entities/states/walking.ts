import { LEMMING_HALF_WIDTH, WALK_SPEED } from "../../config";
import type { Lemming } from "../Lemming";
import { toTile } from "../World";
import type { LemmingState } from "./LemmingState";

/** Walk along the ground; fall off ledges; turn around at obstacles. */
export const walking: LemmingState = {
  name: "walking",

  update(l, world, dt) {
    const { grid } = world;
    if (!l.isGrounded(grid)) return l.setState("falling", world);

    const nx = l.x + l.dir * WALK_SPEED * dt;
    const aheadCol = toTile(nx + l.dir * LEMMING_HALF_WIDTH);
    if (grid.isSolid(aheadCol, l.bodyRow)) return onBlocked(l);

    l.x = nx;
    if (!l.isGrounded(grid)) l.setState("falling", world);
  },
};

function onBlocked(l: Lemming): void {
  l.dir = l.dir === 1 ? -1 : 1;
}
