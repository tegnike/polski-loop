import { describe, expect, it } from "vitest";
import { appendSpeechTranscript, speechRecognitionErrorMessage, transcriptFromResults, type SpeechRecognitionResultEventLike } from "../src/lib/speech-recognition";

describe("browser speech input", () => {
  it("appends recognized speech without deleting a typed draft", () => {
    expect(appendSpeechTranscript("この文法について", "教えてください")).toBe("この文法について 教えてください");
    expect(appendSpeechTranscript("Poproszę ", "kawę")).toBe("Poproszę kawę");
  });

  it("keeps the chat input within its maximum length", () => {
    expect(appendSpeechTranscript("1234", "5678", 6)).toBe("1234 5");
  });

  it("combines all recognition result segments", () => {
    const event = {
      results: {
        0: { 0: { transcript: "Dzień dobry" }, length: 1 },
        1: { 0: { transcript: "poproszę kawę" }, length: 1 },
        length: 2,
      },
    } as unknown as SpeechRecognitionResultEventLike;
    expect(transcriptFromResults(event)).toBe("Dzień dobry poproszę kawę");
  });

  it("maps actionable browser errors and ignores an intentional abort", () => {
    expect(speechRecognitionErrorMessage("not-allowed")).toContain("マイク権限");
    expect(speechRecognitionErrorMessage("language-not-supported")).toContain("言語");
    expect(speechRecognitionErrorMessage("aborted")).toBeNull();
  });
});
