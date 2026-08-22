import { describe, expect, it } from "vitest";
import { buildMissionPrompt } from "../src/lib/mission";

const input = {
  missionId: "a1-u3-l2-mission",
  lessonId: "a1-u3-l2",
  scenario: "店でパンを買う。",
  learnerRole: "ポーランド語学習者",
  partnerRole: "店員",
  difficultyLevel: "A1" as const,
  partnerBehavior: "短く返答する。",
  endingCondition: "注文を終える。",
  feedbackFormat: "重要な誤りを伝える。",
};

describe("Voice mission prompt", () => {
  it("starts by identifying the user as a Polish-language learner", () => {
    const prompt = buildMissionPrompt(input, ["Poproszę chleb."], ["Co podać?"]);
    expect(prompt.startsWith("ユーザーはポーランド語の学習者です。\n")).toBe(true);
    expect(prompt).toContain("必須表現（学習者が少なくとも3つ使う）:\n- Poproszę chleb.");
    expect(prompt).toContain("相手側に出してほしい表現・反応:\n- Co podać?");
    expect(prompt).toContain("以下はユーザーから指示があった場合のみ対応してください。");
    expect(prompt).toContain('"schemaVersion": "polski-loop.voice-result.v1"');
    expect(prompt).toContain('"missionId": "a1-u3-l2-mission"');
    expect(prompt).toContain("polski-loop-voice-result-a1-u3-l2-mission.json");
  });

  it("keeps explicit fallbacks when a mission has no linked expressions", () => {
    const prompt = buildMissionPrompt(input, [], []);
    expect(prompt).toContain("- lessonで学んだ表現を3つ");
    expect(prompt).toContain("- 相手の短い質問や返答");
  });
});
