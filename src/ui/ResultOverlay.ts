import { byId } from "./Hud";

export interface LevelResult {
  won: boolean;
  saved: number;
  required: number;
  total: number;
  /** Whether a "Next level" button makes sense. */
  hasNext: boolean;
}

/** The end-of-level panel over the canvas, with Retry / Next level buttons. */
export class ResultOverlay {
  private readonly root = byId("result");
  private readonly title = byId("result-title");
  private readonly detail = byId("result-detail");
  private readonly next = byId<HTMLButtonElement>("result-next");

  constructor(handlers: { onRetry: () => void; onNext: () => void }) {
    byId("result-retry").addEventListener("click", handlers.onRetry);
    this.next.addEventListener("click", handlers.onNext);
  }

  show(r: LevelResult): void {
    this.title.textContent = r.won ? "Level complete!" : "Not enough saved";
    this.title.classList.toggle("text-lime-300", r.won);
    this.title.classList.toggle("text-red-400", !r.won);
    const pct = Math.round((r.saved / r.total) * 100);
    this.detail.textContent = `Saved ${r.saved} of ${r.total} (${pct}%) — needed ${r.required}.`;
    this.next.classList.toggle("hidden", !(r.won && r.hasNext));
    this.root.classList.replace("hidden", "flex");
  }

  hide(): void {
    this.root.classList.replace("flex", "hidden");
  }
}
