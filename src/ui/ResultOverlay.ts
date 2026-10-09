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
  /** The attempt ended at its deadline rather than by clearing the crowd. */
  timedOut?: boolean;
  /**
   * Set when this wasn't a real level: a playtest from the editor ("editor", the way on is back to
   * it) or a level opened from a link ("link", which can be copied into the editor). Neither saves anything.
   */
  trial: "editor" | "link" | null;
  /** What this attempt changed in the saved progress (null for a trial). */
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
  private readonly copy = byId<HTMLButtonElement>("result-copy");

  constructor(handlers: {
    onRetry: () => void;
    onNext: () => void;
    onLevels: () => void;
    onEditor: () => void;
    onEditCopy: () => void;
  }) {
    byId("result-retry").addEventListener("click", handlers.onRetry);
    this.levels.addEventListener("click", handlers.onLevels);
    this.editor.addEventListener("click", handlers.onEditor);
    this.copy.addEventListener("click", handlers.onEditCopy);
    this.next.addEventListener("click", handlers.onNext);
  }

  show(r: LevelResult): void {
    this.title.textContent = r.won ? "Level complete!" : r.timedOut ? "Time's up!" : "Not enough saved";
    this.title.classList.toggle("text-lime-300", r.won);
    this.title.classList.toggle("text-red-400", !r.won);
    const pct = Math.round((r.saved / r.total) * 100);
    this.detail.textContent = `Saved ${r.saved} of ${r.total} (${pct}%) — needed ${r.required}, in ${formatTime(r.time)}.`;
    if (r.timedOut) this.detail.textContent += " Time ran out; everyone who had not reached the exit counts as lost.";

    this.levels.classList.toggle("hidden", r.trial === "editor");
    this.editor.classList.toggle("hidden", r.trial !== "editor");
    this.copy.classList.toggle("hidden", r.trial !== "link");
    this.showProgress(r);
    this.next.classList.toggle("hidden", r.trial !== null || !(r.won && r.hasNext));
    this.root.classList.replace("hidden", "flex");
  }

  /** "First clear!" and the personal best; a trial has neither. */
  private showProgress(r: LevelResult): void {
    if (!r.progress) {
      this.news.classList.add("hidden");
      this.best.textContent = `${r.trial === "link" ? "Shared level" : "Playtest"}: nothing is saved.`;
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
