import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePronunciationText, playPronunciation, pronunciationCachePath } from "../src/lib/pronunciation";
import { inferSpeakerGender, POLISH_CHIRP3_HD_VOICES, selectPolishVoice } from "../src/lib/pronunciation-config";

describe("pronunciation cache keys", () => {
  it("normalizes equivalent Polish text before caching", () => {
    expect(normalizePronunciationText("  dzien\u0301   dobry  ")).toBe("dzień dobry");
  });

  it("includes engine settings and the encoded text", () => {
    expect(pronunciationCachePath("Dzień dobry")).toMatch(
      /^\/__pronunciation-cache\/google-chirp3-hd-v1\/any\/pl-PL-Chirp3-HD-[^/]+\/Dzie%C5%84%20dobry$/u,
    );
  });

  it("uses one key for whitespace-equivalent requests", () => {
    expect(pronunciationCachePath("Co  słychać?")).toBe(pronunciationCachePath(" Co słychać? "));
  });

  it("uses a stable voice for the same text and spreads text across voices", () => {
    expect(selectPolishVoice("Dzień dobry")).toEqual(selectPolishVoice("Dzień dobry"));
    const voices = new Set(["Dzień dobry", "Do widzenia", "Jak się masz?", "Dziękuję", "Proszę"].map((text) => selectPolishVoice(text).name));
    expect(voices.size).toBeGreaterThan(1);
  });

  it("never crosses an explicit speaker gender", () => {
    expect(POLISH_CHIRP3_HD_VOICES.filter((voice) => voice.gender === "female").length).toBeGreaterThan(10);
    expect(POLISH_CHIRP3_HD_VOICES.filter((voice) => voice.gender === "male").length).toBeGreaterThan(10);
    expect(selectPolishVoice("Jestem gotowa", "female").gender).toBe("female");
    expect(selectPolishVoice("Jestem gotowy", "male").gender).toBe("male");
  });

  it("infers only strong first-person gender markers", () => {
    expect(inferSpeakerGender("Wczoraj pracowałam w domu.")).toBe("female");
    expect(inferSpeakerGender("Wczoraj pracowałem w domu.")).toBe("male");
    expect(inferSpeakerGender("Ona była zmęczona.")).toBe("any");
  });
});

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  static nextPlayError: Error | null = null;

  preload = "";
  volume = 1;
  src: string;
  play = vi.fn(async () => {
    if (FakeAudio.nextPlayError) throw FakeAudio.nextPlayError;
  });
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn((name: string) => {
    if (name === "src") this.src = "";
  });

  constructor(src: string) {
    super();
    this.src = src;
    FakeAudio.instances.push(this);
  }
}

describe("pronunciation playback", () => {
  const createObjectURL = vi.fn(() => "blob:pronunciation");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    FakeAudio.instances = [];
    FakeAudio.nextPlayError = null;
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays through a native audio element and releases its object URL", async () => {
    const playback = playPronunciation(new Blob(["mp3"], { type: "audio/mpeg" }));
    const audio = FakeAudio.instances[0];

    expect(audio.src).toBe("blob:pronunciation");
    expect(audio.preload).toBe("auto");
    expect(audio.volume).toBe(1);
    expect(audio.play).toHaveBeenCalledOnce();

    audio.dispatchEvent(new Event("ended"));
    await expect(playback).resolves.toBeUndefined();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(audio.load).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pronunciation");
  });

  it("rejects and cleans up when native playback fails", async () => {
    FakeAudio.nextPlayError = new Error("blocked");

    await expect(playPronunciation(new Blob(["mp3"], { type: "audio/mpeg" }))).rejects.toThrow(
      "音声を再生できませんでした。",
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pronunciation");
  });
});
