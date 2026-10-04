import type { RecordUpdate } from "../progress/Progress";
import { byId, formatTime } from "./Hud";

export interface LevelResult {
  won: boolean;
  saved: number;
  required: number;
  total: number;
  /** Whether a "Next level" button makes sense. */
  hasNext: boolean;
  /** Simulated seconds the attempt took. */
  time: number;
  /** A trial run from the level editor: nothing is saved, and the way on is back to the editor. */
  playtest: boolean;
  /** What this attempt changed in the saved progress (null for a playtest). */
  progress: RecordUpdate | null;
}

/** The end-of-level panel over the canvas, with Retry / Next level buttons. */
export class ResultOverlay {
  private readonly root = byId("result");
  private readonly title = byId("result-title");
  private readonly detail = byId("result-detail");
  private readonly news = byId("result-news");
  private readonly best = byId("result-best");
  private readonly next = byId<HTMLButtonElement>("result-next");
  private readonly levels = byId<HTMLButtonElement>("result-levels");
  private readonly editor = byId<HTMLButtonElement>("result-editor");

  constructor(handlers: { onRetry: () => void; onNext: () => void; onLevels: () => void; onEditor: () => void }) {
    byId("result-retry").addEventListener("click", handlers.onRetry);
    this.levels.addEventListener("click", handlers.onLevels);
    this.editor.addEventListener("click", handlers.onEditor);
    this.next.addEventListener("click", handlers.onNext);
  }

  show(r: LevelResult): void {
    this.title.textContent = r.won ? "Level complete!" : "Not enough saved";
    this.title.classList.toggle("text-lime-300", r.won);
    this.title.classList.toggle("text-red-400", !r.won);
    const pct = Math.round((r.saved / r.total) * 100);
    this.detail.textContent = `Saved ${r.saved} of ${r.total} (${pct}%) — needed ${r.required}, in ${formatTime(r.time)}.`;

    this.levels.classList.toggle("hidden", r.playtest);
    this.editor.classList.toggle("hidden", !r.playtest);
    this.showProgress(r);
    this.next.classList.toggle("hidden", r.playtest || !(r.won && r.hasNext));
    this.root.classList.replace("hidden", "flex");
  }

  /** "First clear!" and the personal best; a playtest has neither. */
  private showProgress(r: LevelResult): void {
    if (!r.progress) {
      this.news.classList.add("hidden");
      this.best.textContent = "Playtest: nothing is saved.";
      return;
    }
    const { record, firstWin, newBestSaved, newFastestWin } = r.progress;
    const news = firstWin
      ? "First clear!"
      : [newBestSaved && "New best saved!", newFastestWin && "New fastest win!"].filter(Boolean).join(" ");
    this.news.textContent = news;
    this.news.classList.toggle("hidden", !news);
    const fastest = record.fastestWin === null ? "" : ` · fastest win ${formatTime(record.fastestWin)}`;
    const attempts = `${record.attempts} attempt${record.attempts === 1 ? "" : "s"}`;
    this.best.textContent = `Best ${record.bestSaved}/${r.total}${fastest} · ${record.wins} won of ${attempts}`;
  }

  hide(): void {
    this.root.classList.replace("flex", "hidden");
  }
}
