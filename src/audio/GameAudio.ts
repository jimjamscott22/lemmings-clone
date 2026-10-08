import type { SimulationEvent } from "../entities/World";

const COOLDOWN: Record<SimulationEvent, number> = { hatch: 0.3, dig: 0.08, splash: 0.12, exit: 0.8 };

/** Browser-only sound output. Simulation events never depend on audio being available. */
export class GameAudio {
  private context: AudioContext | null = null;
  private unlocked = false;
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private readonly lastPlayed = new Map<SimulationEvent, number>();
  private utterance: SpeechSynthesisUtterance | null = null;
  private readonly played: Record<SimulationEvent, number> = { hatch: 0, dig: 0, splash: 0, exit: 0 };
  private exitVoice: "speech" | "chirp" | null = null;

  constructor(private enabled: boolean) {
    // Some browsers load voices asynchronously after the first query; start that before a rescue.
    try { window.speechSynthesis?.getVoices(); } catch { /* The chirp remains available. */ }
    // Resume/create the context in the actual gesture, never in an animation frame.
    const unlock = (event: Event) => {
      if (event.isTrusted && (!(event instanceof KeyboardEvent) || !event.repeat)) this.unlock();
    };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
    });
    window.addEventListener("blur", () => this.stop());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.unlock();
    else this.stop();
  }

  private unlock(): void {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      this.unlocked = true;
      if (this.context.state === "suspended") void this.context.resume().catch(() => {});
    } catch {
      // Unsupported or blocked audio must not interrupt a rescue.
    }
  }

  play(event: SimulationEvent): void {
    const context = this.context;
    if (!this.enabled || !this.unlocked || document.hidden || context?.state !== "running") return;
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(event) ?? -Infinity) < COOLDOWN[event]) return;
    if (this.sources.size + 2 > 8) return; // Each effect uses at most two sources.
    this.lastPlayed.set(event, now);
    try {
      switch (event) {
        case "hatch":
          this.tone(180, 420, 0.15, 0.12, "triangle");
          this.noise(0.12, 0.08, 900, "lowpass");
          break;
        case "dig":
          this.noise(0.07, 0.1, 1600, "bandpass");
          this.tone(140, 65, 0.07, 0.04, "triangle");
          break;
        case "splash":
          this.noise(0.28, 0.13, 1200, "lowpass");
          this.tone(550, 160, 0.16, 0.05, "sine");
          break;
        case "exit":
          if (!this.yippie()) return;
          break;
      }
      this.played[event]++;
    } catch {
      // Device changes or unavailable speech output should stay silent, not break gameplay.
    }
  }

  /** Drop active output and cooldowns. Nothing is queued for resume or the next level. */
  stop(): void {
    for (const source of this.sources) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect();
    }
    this.sources.clear();
    this.lastPlayed.clear();
    if (this.utterance) {
      this.utterance = null;
      window.speechSynthesis?.cancel();
    }
  }

  debug(): object {
    return {
      enabled: this.enabled,
      unlocked: this.unlocked,
      contextState: this.context?.state ?? "uninitialized",
      activeSources: this.sources.size,
      speaking: this.utterance !== null,
      exitVoice: this.exitVoice,
      played: { ...this.played },
    };
  }

  private track(source: AudioScheduledSourceNode, gain: GainNode, filter?: BiquadFilterNode): void {
    this.sources.add(source);
    source.addEventListener("ended", () => {
      this.sources.delete(source);
      source.disconnect();
      gain.disconnect();
      filter?.disconnect();
    }, { once: true });
  }

  private tone(from: number, to: number, duration: number, volume: number, type: OscillatorType, delay = 0): void {
    const context = this.context!;
    const at = context.currentTime + delay;
    const source = context.createOscillator();
    const gain = context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(from, at);
    source.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    source.connect(gain).connect(context.destination);
    this.track(source, gain);
    source.start(at);
    source.stop(at + duration + 0.01);
  }

  private noise(duration: number, volume: number, frequency: number, type: BiquadFilterType): void {
    const context = this.context!;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    this.track(source, gain, filter);
    source.start();
  }

  private chirp(): void {
    this.exitVoice = "chirp";
    if (this.sources.size + 2 > 8) return;
    this.tone(660, 880, 0.12, 0.12, "triangle");
    this.tone(880, 1320, 0.22, 0.1, "sine", 0.12);
  }

  private yippie(): boolean {
    // Don't build an ever-growing speech queue when the crowd reaches the goal together.
    if (this.utterance) return false;
    const speech = window.speechSynthesis;
    let voices: SpeechSynthesisVoice[] = [];
    try { voices = speech?.getVoices() ?? []; } catch { /* Use the chirp below. */ }
    const voice = voices.find((v) => v.localService && /^en(?:-|$)/i.test(v.lang))
      ?? voices.find((v) => /^en(?:-|$)/i.test(v.lang));
    if (!voice || typeof SpeechSynthesisUtterance === "undefined") {
      this.chirp();
      return true;
    }

    const utterance = new SpeechSynthesisUtterance("Yippie!");
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.pitch = 2;
    utterance.rate = 1.3;
    utterance.volume = 0.5;
    this.utterance = utterance;
    this.exitVoice = "speech";
    utterance.onend = () => {
      if (this.utterance === utterance) this.utterance = null;
    };
    utterance.onerror = () => {
      if (this.utterance !== utterance) return; // A cancelled phrase must not chirp in a menu.
      this.utterance = null;
      if (this.enabled && !document.hidden && this.context?.state === "running") this.chirp();
    };
    try {
      speech.speak(utterance);
    } catch {
      this.utterance = null;
      this.chirp();
    }
    return true;
  }
}
