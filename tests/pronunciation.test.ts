import { describe, expect, it } from "vitest";
import { normalizePronunciationText, pronunciationCachePath } from "../src/lib/pronunciation";
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
