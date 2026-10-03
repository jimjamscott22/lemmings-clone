import { EXIT_TIME, SPLAT_TIME } from "../config";
import type { Lemming } from "../entities/Lemming";
import { isFloating } from "../entities/states/falling";
import { isDrowning } from "../entities/states/swimming";
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
      rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      if (isFloating(l)) {
        // Umbrella held overhead, swaying gently
        const sway = frame === 0 ? 0 : 1;
        rect(-2 + sway, -16, 5, 1, PALETTE.umbrella);
        rect(-4 + sway, -15, 9, 1, PALETTE.umbrella);
        rect(-5 + sway, -14, 11, 1, PALETTE.umbrellaDark);
        rect(0 + sway, -13, 1, 3, PALETTE.pick);
        rect(1, -11, 1, 2, PALETTE.lemmingSkin);
      } else {
        // Arms flung up, legs together
        rect(-3, -11, 1, 3, PALETTE.lemmingSkin);
        rect(2, -11, 1, 3, PALETTE.lemmingSkin);
      }
      break;

    case "climbing":
      drawBody(rect);
      // Pressed against the wall, hand over hand
      rect(2, frame === 0 ? -12 : -10, 1, 3, PALETTE.lemmingSkin);
      rect(1, frame === 0 ? -3 : -2, 2, 1, PALETTE.lemmingBodyDark);
      rect(-1, -2, 2, 2, PALETTE.lemmingBodyDark);
      break;

    case "blocking":
      drawBody(rect);
      // Arms out, feet planted
      rect(-5, -6, 3, 1, PALETTE.lemmingSkin);
      rect(2, -6, 3, 1, PALETTE.lemmingSkin);
      rect(-2, -2, 1, 2, PALETTE.lemmingBodyDark);
      rect(1, -2, 1, 2, PALETTE.lemmingBodyDark);
      break;

    case "bashing": {
      drawBody(rect);
      rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      // Punching forward, with debris on the hit
      const punch = frame === 0;
      rect(2, -6, punch ? 4 : 2, 1, PALETTE.lemmingSkin);
      if (punch) rect(6, -8, 1, 1, PALETTE.dirtLight);
      break;
    }

    case "mining": {
      drawBody(rect);
      rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      // Pick swinging down and forward
      const raised = frame === 0;
      rect(2, raised ? -8 : -5, 2, 1, PALETTE.lemmingSkin);
      if (raised) rect(3, -11, 1, 3, PALETTE.pick);
      else {
        rect(4, -3, 2, 1, PALETTE.pick);
        rect(6, -1, 1, 1, PALETTE.dirtLight);
      }
      break;
    }

    case "splatting":
      // Flattened, fading away
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - l.stateTime / SPLAT_TIME);
      rect(-4, -2, 8, 2, PALETTE.lemmingBody);
      rect(-3, -3, 3, 1, PALETTE.lemmingHair);
      rect(1, -3, 2, 1, PALETTE.lemmingSkin);
      ctx.restore();
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

    case "swimming":
      // Only the head shows above the surface; arms paddle, or reach up once sinking.
      rect(-2, -10, 4, 2, PALETTE.lemmingHair);
      rect(1, -9, 2, 1, PALETTE.lemmingHair);
      rect(-1, -8, 3, 1, PALETTE.lemmingSkin);
      if (isDrowning(l)) {
        rect(-3, -12, 1, 3, PALETTE.lemmingSkin);
        rect(3, -12 + frame, 1, 3, PALETTE.lemmingSkin);
      } else {
        rect(frame === 0 ? 2 : 3, -7, 2, 1, PALETTE.lemmingSkin);
        rect(frame === 0 ? -4 : -3, -7, 2, 1, PALETTE.lemmingSkin);
      }
      break;

    case "exiting": {
      // Fade into the doorway with a little hop of joy.
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - l.stateTime / EXIT_TIME);
      ctx.translate(0, -Math.round(Math.sin((l.stateTime / EXIT_TIME) * Math.PI) * 3));
      drawBody(rect);
      rect(-3, -11, 1, 3, PALETTE.lemmingSkin);
      rect(2, -11, 1, 3, PALETTE.lemmingSkin);
      rect(-1, -2, 3, 2, PALETTE.lemmingBodyDark);
      ctx.restore();
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

  // A bomber's countdown floats above its head (never mirrored, so the digit reads correctly).
  if (l.fuse !== null && !l.done) drawDigit(ctx, Math.ceil(l.fuse), cx - 1, by - 18, PALETTE.fuse);
}

/** 3×5 pixel digits, one row of three bits per line, top to bottom. */
const DIGITS = [
  "111101101101111",
  "010110010010111",
  "111001111100111",
  "111001111001111",
  "101101111001001",
  "111100111001111",
  "111100111101111",
  "111001001001001",
  "111101111101111",
  "111101111001111",
];

function drawDigit(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, color: string): void {
  const bits = DIGITS[Math.min(9, Math.max(0, n))]!;
  ctx.fillStyle = color;
  for (let i = 0; i < 15; i++) if (bits[i] === "1") ctx.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
}

type RectFn = (dx: number, dy: number, w: number, h: number, color: string) => void;

/** Hair, face and torso: shared by every pose. */
function drawBody(rect: RectFn): void {
  rect(-2, -10, 4, 2, PALETTE.lemmingHair);
  rect(1, -9, 2, 1, PALETTE.lemmingHair); // fringe sweeping forward
  rect(-1, -8, 3, 2, PALETTE.lemmingSkin);
  rect(-2, -6, 4, 4, PALETTE.lemmingBody);
}
