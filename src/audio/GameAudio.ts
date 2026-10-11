import type { SimulationEvent } from "../entities/World";
import type { SkillId } from "../skills/skills";
import yippieUrl from "./assets/YIPPEE1.wav?url";
import letsGoUrl from "./assets/LETSGO1.wav?url";
import climberUrl from "./assets/CLIMBER2.wav?url";
import floaterUrl from "./assets/FLOATER1.wav?url";
import bomberUrl from "./assets/BOMBER.wav?url";
import blockerUrl from "./assets/BLOCKER1.wav?url";
import basherUrl from "./assets/BASHER2.wav?url";
import minerUrl from "./assets/MINER2.wav?url";
import cheersUrl from "./assets/CHEERS1.wav?url";
import boosUrl from "./assets/BOOS.wav?url";

type AudioEvent = SimulationEvent | SkillId | "won" | "lost";
type SampleEvent = Exclude<AudioEvent, "dig" | "splash">;

const SAMPLE_URLS: Record<SampleEvent, string> = {
  hatch: letsGoUrl, exit: yippieUrl,
  climber: climberUrl, floater: floaterUrl, bomber: bomberUrl,
  blocker: blockerUrl, basher: basherUrl, miner: minerUrl,
  won: cheersUrl, lost: boosUrl,
};
const COOLDOWN: Record<AudioEvent, number> = {
  hatch: 0.3, dig: 0.08, splash: 0.12, exit: 0.8,
  climber: 0.3, floater: 0.3, bomber: 0.3, blocker: 0.3, basher: 0.3, miner: 0.3,
  won: 1, lost: 1,
};

/** Browser-only sound output. Simulation events never depend on audio being available. */
export class GameAudio {
  private context: AudioContext | null = null;
  private unlocked = false;
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private readonly lastPlayed = new Map<AudioEvent, number>();
  private readonly sampleBuffers = new Map<SampleEvent, AudioBuffer>();
  private samplesLoad: Promise<void> | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;
  private voiceEvent: SampleEvent | null = null;
  private voiceEndsAt = 0;
  private readonly played: Record<AudioEvent, number> = {
    hatch: 0, dig: 0, splash: 0, exit: 0,
    climber: 0, floater: 0, bomber: 0, blocker: 0, basher: 0, miner: 0, won: 0, lost: 0,
  };
  private exitVoice: "sample" | "chirp" | null = null;

  constructor(private enabled: boolean) {
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
      this.loadSamples(this.context);
      this.unlocked = true;
      if (this.context.state === "suspended") void this.context.resume().catch(() => {});
    } catch {
      // Unsupported or blocked audio must not interrupt a rescue.
    }
  }

  private loadSamples(context: AudioContext): void {
    this.samplesLoad ??= (async () => {
      for (const event of Object.keys(SAMPLE_URLS) as SampleEvent[]) {
        try {
          const response = await fetch(SAMPLE_URLS[event]);
          if (!response.ok) continue;
          this.sampleBuffers.set(event, await context.decodeAudioData(await response.arrayBuffer()));
        } catch {
          // Prepare samples only; late loading never replays a stopped event.
        }
      }
    })();
  }

  play(event: AudioEvent): void {
    const context = this.context;
    if (!this.enabled || !this.unlocked || document.hidden || context?.state !== "running") return;
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(event) ?? -Infinity) < COOLDOWN[event]) return;
    if (this.sources.size + 2 > 8) return; // Each effect uses at most two sources.
    this.lastPlayed.set(event, now);
    try {
      switch (event) {
        case "hatch":
          if (this.sampleBuffers.has("hatch")) {
            if (!this.sample("hatch")) return;
            break;
          }
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
          if (this.voiceSource) return;
          if (this.sampleBuffers.has("exit")) {
            if (!this.sample("exit")) return;
            this.exitVoice = "sample";
          } else this.chirp();
          break;
        default:
          if (!this.sample(event)) return;
          break;
      }
      this.played[event]++;
    } catch {
      // Device changes or unavailable audio output should stay silent, not break gameplay.
    }
  }

  /** Drop active output and cooldowns. Nothing is queued for resume or the next level. */
  stop(): void {
    this.voiceSource = null;
    this.voiceEvent = null;
    this.voiceEndsAt = 0;
    for (const source of this.sources) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect();
    }
    this.sources.clear();
    this.lastPlayed.clear();
  }

  debug(): object {
    return {
      enabled: this.enabled,
      unlocked: this.unlocked,
      contextState: this.context?.state ?? "uninitialized",
      activeSources: this.sources.size,
      exitPlaying: this.voiceEvent === "exit",
      sampleReady: this.sampleBuffers.has("exit"),
      voicePlaying: this.voiceEvent,
      loadedSamples: [...this.sampleBuffers.keys()],
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

  private sample(event: SampleEvent): boolean {
    const buffer = this.sampleBuffers.get(event);
    if (!buffer) return false;
    const outcome = event === "won" || event === "lost";
    // Drop crowded acknowledgements; only the result may follow the final rescue voice.
    if (this.voiceSource && !outcome) return false;
    if (this.voiceSource && (this.voiceEvent === "won" || this.voiceEvent === "lost")) return false;
    const context = this.context!;
    const at = Math.max(context.currentTime, this.voiceEndsAt);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.5;
    source.connect(gain).connect(context.destination);
    this.track(source, gain);
    source.addEventListener("ended", () => {
      if (this.voiceSource !== source) return;
      this.voiceSource = null;
      this.voiceEvent = null;
      this.voiceEndsAt = 0;
    }, { once: true });
    source.start(at);
    this.voiceSource = source;
    this.voiceEvent = event;
    this.voiceEndsAt = at + buffer.duration;
    return true;
  }
}
