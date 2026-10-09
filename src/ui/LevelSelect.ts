import type { LevelRecord } from "../progress/Progress";
import { byId, formatTime } from "./Hud";

/** One card on the level select screen. */
export interface LevelCard {
  name: string;
  lemmingCount: number;
  requiredToSave: number;
  timeLimit?: number;
  unlocked: boolean;
  record: LevelRecord;
}

/**
 * Full-screen level select over the viewport: a card per level showing whether it's locked,
 * solved, and the player's bests. Locked cards are disabled buttons.
 */
export class LevelSelect {
  private readonly root = byId("levels");
  private readonly grid = byId("levels-grid");
  private readonly solved = byId("levels-solved");

  constructor(private readonly handlers: { onChoose: (index: number) => void; onClose: () => void; onReset: () => void }) {
    byId("levels-close").addEventListener("click", handlers.onClose);
    byId("levels-reset").addEventListener("click", handlers.onReset);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  /** Show (or refresh) the screen, with `current` highlighted and focused for Enter to start it. */
  open(cards: readonly LevelCard[], current: number): void {
    const solved = cards.filter((c) => c.record.wins > 0).length;
    this.solved.textContent = `Solved ${solved}/${cards.length}`;
    const buttons = cards.map((card, i) => this.card(card, i, cards, i === current));
    this.grid.replaceChildren(...buttons.map(wrap));
    this.root.classList.replace("hidden", "flex");
    const focus = buttons[current];
    (focus && !focus.disabled ? focus : buttons.find((b) => !b.disabled))?.focus();
  }

  close(): void {
    this.root.classList.replace("flex", "hidden");
  }

  private card(card: LevelCard, index: number, cards: readonly LevelCard[], current: boolean): HTMLButtonElement {
    const { name, lemmingCount: total, requiredToSave: need, unlocked, record } = card;
    const solved = record.wins > 0;

    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !unlocked;
    button.className =
      "flex h-full w-full flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors " +
      (unlocked
        ? "border-stone-700 bg-stone-900 hover:border-lime-500 hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-lime-400"
        : "cursor-not-allowed border-stone-800 bg-stone-900/40 text-stone-600");
    if (current && unlocked) button.classList.add("ring-2", "ring-lime-500/60");
    if (unlocked) button.addEventListener("click", () => this.handlers.onChoose(index));

    const head = document.createElement("div");
    head.className = "flex items-baseline justify-between gap-2";
    const title = document.createElement("span");
    title.className = `font-pixel ${unlocked ? "text-stone-100" : ""}`;
    title.textContent = `${index + 1}. ${name}`;
    const badge = document.createElement("span");
    badge.className = solved ? "text-lime-300" : "text-stone-500";
    badge.textContent = solved ? "✓" : unlocked ? "" : "🔒";
    badge.setAttribute("aria-label", solved ? "solved" : unlocked ? "unsolved" : "locked");
    head.append(title, badge);

    const status = document.createElement("span");
    status.className = "text-xs text-stone-400";
    if (!unlocked) {
      status.className = "text-xs";
      status.textContent = `Solve “${cards[index - 1]?.name ?? "the previous level"}” to unlock`;
    } else if (record.attempts === 0) {
      status.textContent = `Save ${need} of ${total}`;
    } else {
      const fastest = record.fastestWin === null ? "" : ` · ${formatTime(record.fastestWin)}`;
      status.textContent = `Best ${record.bestSaved}/${total}${fastest} · need ${need}`;
    }

    const attempts = document.createElement("span");
    attempts.className = "text-[10px] text-stone-500";
    if (unlocked && record.attempts > 0) {
      attempts.textContent = `${record.wins} won of ${record.attempts} attempt${record.attempts === 1 ? "" : "s"}`;
    }

    const deadline = document.createElement("span");
    deadline.className = "text-xs text-stone-400";
    deadline.textContent = card.timeLimit ? `Time limit ${formatTime(card.timeLimit)}` : "Untimed";
    button.append(head, status, deadline, attempts);
    return button;
  }
}

function wrap(button: HTMLButtonElement): HTMLLIElement {
  const li = document.createElement("li");
  li.append(button);
  return li;
}
