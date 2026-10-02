import { TILE_SIZE } from "../config";
import type { Level, TilePoint } from "../world/Level";
import { PALETTE } from "./palette";
import { TileLayer } from "./TileLayer";

export interface RenderState {
  /** Seconds of simulated time, for animations. */
  time: number;
  showGrid: boolean;
  hoverTile: TilePoint | null;
}

/**
 * Owns the visible canvas. Draws at native resolution (cols*TILE x rows*TILE) and lets CSS
 * upscale by an integer factor so pixels stay crisp.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private tileLayer: TileLayer | null = null;
  private background: HTMLCanvasElement | null = null;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly viewport: HTMLElement,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resizeObserver = new ResizeObserver(() => this.fitToViewport());
    this.resizeObserver.observe(viewport);
  }

  setLevel(level: Level): void {
    this.tileLayer?.dispose();
    const { grid } = level;
    this.canvas.width = grid.cols * TILE_SIZE;
    this.canvas.height = grid.rows * TILE_SIZE;
    this.ctx.imageSmoothingEnabled = false;
    this.background = this.buildBackground(this.canvas.width, this.canvas.height);
    this.drawSpawnHatch(this.background.getContext("2d")!, level.spawn);
    this.tileLayer = new TileLayer(grid);
    this.fitToViewport();
  }

  draw(state: RenderState): void {
    const { ctx, canvas } = this;
    if (!this.tileLayer || !this.background) return;

    ctx.drawImage(this.background, 0, 0);
    this.tileLayer.draw(ctx, state.time);

    if (state.showGrid) this.drawGridLines(canvas.width, canvas.height);
    if (state.hoverTile) this.drawHover(state.hoverTile);
  }

  private drawGridLines(w: number, h: number): void {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.gridLine;
    for (let x = TILE_SIZE; x < w; x += TILE_SIZE) ctx.fillRect(x, 0, 1, h);
    for (let y = TILE_SIZE; y < h; y += TILE_SIZE) ctx.fillRect(0, y, w, 1);
  }

  private drawHover({ x, y }: TilePoint): void {
    const { ctx } = this;
    ctx.strokeStyle = PALETTE.hover;
    ctx.lineWidth = 1;
    // +0.5 aligns a 1px stroke to the pixel grid
    ctx.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  private buildBackground(w: number, h: number): HTMLCanvasElement {
    const bg = document.createElement("canvas");
    bg.width = w;
    bg.height = h;
    const g = bg.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // A sprinkle of stars, deterministic so it doesn't change between reloads.
    let seed = 1337;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.5})`;
      g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h * 0.7), 1, 1);
    }
    return bg;
  }

  /** Entrance trapdoor centred on the spawn tile; static, so it's baked into the background. */
  private drawSpawnHatch(g: CanvasRenderingContext2D, { x, y }: TilePoint): void {
    const cx = x * TILE_SIZE + TILE_SIZE / 2;
    const top = y * TILE_SIZE - 4;
    g.fillStyle = PALETTE.wallDark;
    g.fillRect(cx - 12, top, 24, 8);
    g.fillStyle = PALETTE.wall;
    g.fillRect(cx - 12, top, 24, 2);
    // Open doors, angled down
    g.fillStyle = PALETTE.bridgeDark;
    for (let i = 0; i < 5; i++) {
      g.fillRect(cx - 10 + i, top + 8 + i, 2, 1);
      g.fillRect(cx + 8 - i, top + 8 + i, 2, 1);
    }
    g.fillStyle = "#000";
    g.fillRect(cx - 8, top + 6, 16, 2);
  }

  /**
   * Scale the canvas to fill the viewport. Snaps to integer factors once ≥2x (perfectly even pixels);
   * below that, a fractional fit is preferable to a tiny 1x canvas.
   */
  private fitToViewport(): void {
    const { canvas, viewport } = this;
    if (canvas.width === 0) return;
    const pad = 16;
    const fit = Math.min((viewport.clientWidth - pad) / canvas.width, (viewport.clientHeight - pad) / canvas.height);
    const scale = Math.max(0.5, fit >= 2 ? Math.floor(fit) : fit);
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
  }
}
