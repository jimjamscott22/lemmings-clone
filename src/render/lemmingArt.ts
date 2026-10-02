import type { Lemming } from "../entities/Lemming";
import { PALETTE } from "./palette";

/**
 * Draws a lemming as a handful of rects (about 7×10 px) anchored at its feet.
 * Sprites are authored facing right; `rect` mirrors them for left-facing lemmings.
 */
export function drawLemming(ctx: CanvasRenderingContext2D, l: Lemming): void {
  const cx = Math.round(l.x);
  const by = Math.round(l.y);
  const rect = (dx: number, dy: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    const x = l.dir === 1 ? cx + dx : cx - dx - w;
    ctx.fillRect(x, by + dy, w, h);
  };

  const frame = Math.floor(l.stateTime * 8) % 2;

  switch (l.state.name) {
    case "falling":
      drawBody(rect);
      // Arms flung up, legs together
      rect(-3, -11, 1, 3, PALETTE.lemmingSkin);
      rect(2, -11, 1, 3, PALETTE.lemmingSkin);
      rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      break;

    case "jumping":
      drawBody(rect);
      rect(2, -8, 2, 1, PALETTE.lemmingSkin); // arm reaching forward
      rect(-2, -2, 1, 1, PALETTE.lemmingBodyDark); // legs tucked
      rect(1, -2, 2, 1, PALETTE.lemmingBodyDark);
      break;

    case "digging": {
      drawBody(rect);
      rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      // Pick swinging between raised and striking
      const raised = frame === 0;
      rect(2, raised ? -8 : -5, 2, 1, PALETTE.lemmingSkin);
      rect(raised ? 3 : 4, raised ? -10 : -6, 1, raised ? 3 : 2, PALETTE.pick);
      if (!raised) rect(5, -4, 1, 1, PALETTE.dirtLight); // flying dirt
      break;
    }

    case "building": {
      drawBody(rect);
      rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      // Kneeling hammer tap, with the plank being laid
      rect(2, frame === 0 ? -6 : -4, 2, 1, PALETTE.lemmingSkin);
      rect(-3, -1, 7, 1, PALETTE.bridge);
      break;
    }

    case "walking":
    default:
      drawBody(rect);
      if (frame === 0) {
        rect(-2, -2, 1, 2, PALETTE.lemmingBodyDark);
        rect(2, -2, 1, 2, PALETTE.lemmingBodyDark);
      } else {
        rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      }
      rect(2, -6, 1, 2, PALETTE.lemmingSkin); // swinging arm
      break;
  }
}

type RectFn = (dx: number, dy: number, w: number, h: number, color: string) => void;

/** Hair, face and torso: shared by every pose. */
function drawBody(rect: RectFn): void {
  rect(-2, -10, 4, 2, PALETTE.lemmingHair);
  rect(1, -9, 2, 1, PALETTE.lemmingHair); // fringe sweeping forward
  rect(-1, -8, 3, 2, PALETTE.lemmingSkin);
  rect(-2, -6, 4, 4, PALETTE.lemmingBody);
}
