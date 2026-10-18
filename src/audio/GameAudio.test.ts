// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "./GameAudio";

class Source extends EventTarget {
  buffer: unknown;
  connect = vi.fn(() => ({ connect: vi.fn() }));
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.dispatchEvent(new Event("ended")));
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}

class Context {
  currentTime = 0;
  state = "running";
  destination = {};
  sources: Source[] = [];
  gains: { gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  decodeAudioData = vi.fn(async () => ({ duration: 0.7 }));
  createBufferSource(): Source {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
  createOscillator = () => this.createBufferSource();
  createGain() {
    const node = { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    this.gains.push(node);
    return node;
  }
}

describe("sound playback", () => {
  let audio: GameAudio;
  let context: Context;
  let windowListeners: ReturnType<typeof vi.spyOn>;
  let documentListeners: ReturnType<typeof vi.spyOn>;

  async function unlock(): Promise<void> {
    audio.setEnabled(true);
    await vi.waitFor(() => expect(audio.debug()).toMatchObject({ loadedSamples: expect.arrayContaining(["ui-click", "drown", "warning"]) }));
  }

  beforeEach(() => {
    context = new Context();
    vi.stubGlobal("AudioContext", class { constructor() { return context; } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })));
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    windowListeners = vi.spyOn(window, "addEventListener");
    documentListeners = vi.spyOn(document, "addEventListener");
    audio = new GameAudio(true);
  });

  afterEach(() => {
    audio.stop();
    for (const [type, listener, options] of windowListeners.mock.calls) window.removeEventListener(type, listener, options);
    for (const [type, listener, options] of documentListeners.mock.calls) document.removeEventListener(type, listener, options);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps UI feedback independent of gameplay voices and limits repeat clicks", async () => {
    await unlock();
    audio.play("ui-open");
    const menu = context.sources.at(-1)!;
    audio.play("drown");
    const voice = context.sources.at(-1)!;
    audio.play("ui-click");
    audio.play("ui-click");
    expect(menu.stop).toHaveBeenCalledOnce();
    expect(voice.stop).not.toHaveBeenCalled();
    expect(audio.debug()).toMatchObject({ voicePlaying: "drown", played: { "ui-click": 1, drown: 1 } });
    expect(context.gains.at(-1)!.gain.value).toBeLessThan(context.gains[1]!.gain.value);
  });

  it("drops crowded voices and allows them again after playback ends", async () => {
    await unlock();
    audio.play("warning");
    audio.play("fall");
    expect(audio.debug()).toMatchObject({ played: { warning: 1, fall: 0 } });
    context.sources.at(-1)!.dispatchEvent(new Event("ended"));
    audio.play("fall");
    expect(audio.debug()).toMatchObject({ played: { fall: 1 } });
  });

  it("cancels active UI, gameplay, and scheduled result sounds on mute", async () => {
    await unlock();
    audio.play("exit");
    audio.play("lost");
    expect(context.sources[1]!.start).toHaveBeenCalledWith(0.7);
    audio.play("ui-click");
    audio.setEnabled(false);
    expect(context.sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    audio.play("nuke");
    audio.play("ui-open");
    expect(audio.debug()).toMatchObject({ activeSources: 0, voicePlaying: null, uiPlaying: false, played: { nuke: 0, "ui-open": 0 } });
    context.currentTime = 5;
    await unlock();
    expect(context.sources).toHaveLength(3);
  });

  it("stays silent before unlocking and while the tab is hidden", async () => {
    audio.play("ui-click");
    expect(context.sources).toHaveLength(0);
    await unlock();
    audio.play("nuke");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    audio.play("ui-click");
    expect(audio.debug()).toMatchObject({ activeSources: 0, played: { "ui-click": 0 } });
  });

  it("uses immediate UI feedback if samples fail, without replaying anything later", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    audio.setEnabled(true);
    audio.play("ui-play");
    audio.play("drown");
    await Promise.resolve();
    expect(context.sources).toHaveLength(1);
    expect(audio.debug()).toMatchObject({ played: { "ui-play": 1, drown: 0 } });
    audio.stop();
    expect(audio.debug()).toMatchObject({ activeSources: 0 });
  });
});
