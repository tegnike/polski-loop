import { describe, expect, it } from "vitest";
import { normalizePronunciationText, pronunciationCachePath } from "../src/lib/pronunciation";

describe("pronunciation cache keys", () => {
  it("normalizes equivalent Polish text before caching", () => {
    expect(normalizePronunciationText("  dzien\u0301   dobry  ")).toBe("dzień dobry");
  });

  it("includes engine settings and the encoded text", () => {
    expect(pronunciationCachePath("Dzień dobry")).toBe(
      "/__pronunciation-cache/espeak-ng-1.0.2/pl/145/48/Dzie%C5%84%20dobry",
    );
  });

  it("uses one key for whitespace-equivalent requests", () => {
    expect(pronunciationCachePath("Co  słychać?")).toBe(pronunciationCachePath(" Co słychać? "));
  });

  it("synthesizes Polish text as a WAV file", async () => {
    // The package ships ESM/WASM without TypeScript declarations.
    // @ts-expect-error espeak-ng has no declaration file
    const { default: createESpeak } = await import("espeak-ng");
    const instance = await createESpeak({
      arguments: ["-v", "pl", "-w", "test.wav", "Dzień dobry"],
    });
    const wav = instance.FS.readFile("test.wav") as Uint8Array;
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(wav.byteLength).toBeGreaterThan(1_000);
  }, 10_000);
});
