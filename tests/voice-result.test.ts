import { describe, expect, it } from "vitest";
import type { VoiceResultImport } from "../src/lib/types";
import { validateVoiceResultImport } from "../src/lib/voice-result";

const valid: VoiceResultImport = {
  schemaVersion: "polski-loop.voice-result.v1",
  resultId: "11111111-2222-4333-8444-555555555555",
  missionId: "a1-u1-l1-mission",
  lessonId: "a1-u1-l1",
  evaluatedAt: "2026-08-22T20:00:00.000Z",
  scores: { taskCompletion: 4, comprehension: 3, responseAccuracy: 4, targetExpressionUse: 5, interactionFluency: 3 },
  evidence: { understoodPartner: true, respondedToPartner: true, usedRepairStrategy: true, neededRestatement: false },
  summary: "会話を完了できました。",
  strengths: ["必須表現を使えました。"],
  corrections: [{ original: "Mam imię", suggested: "Mam na imię", reason: "naが必要です。" }],
  nextStep: "質問を返す練習をします。",
};

describe("Voice result import contract", () => {
  it("accepts the documented v1 result", () => {
    expect(() => validateVoiceResultImport(valid)).not.toThrow();
  });

  it("rejects an out-of-range score", () => {
    expect(() => validateVoiceResultImport({ ...valid, scores: { ...valid.scores, comprehension: 6 } })).toThrow("1から5");
  });

  it("rejects unsupported schemas and excessive corrections", () => {
    expect(() => validateVoiceResultImport({ ...valid, schemaVersion: "polski-loop.voice-result.v2" as VoiceResultImport["schemaVersion"] })).toThrow("対応していない");
    expect(() => validateVoiceResultImport({ ...valid, corrections: Array.from({ length: 6 }, () => valid.corrections[0]) })).toThrow("最大5件");
  });
});
