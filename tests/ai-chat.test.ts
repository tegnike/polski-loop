import { describe, expect, it } from "vitest";
import { buildAiTutorInstructions, extractOpenAiResponseText, parseAiTutorMessage, validateAiChatRequest } from "../src/lib/ai-chat";
import { buildAppAiContext } from "../src/lib/ai-context";
import type { AiChatRequest, StatusResponse } from "../src/lib/types";

const validRequest: AiChatRequest = {
  context: { key: "study:lesson:1", label: "最初の会話 1/5", content: "問題: Dzień dobry\n意味: こんにちは" },
  messages: [
    { role: "user", content: "店員役をしてください。" },
    { role: "assistant", content: "Dzień dobry! W czym mogę pomóc?" },
    { role: "user", content: "Dzień dobry. Poproszę kawę." },
  ],
};

describe("AI chat contract", () => {
  it("accepts one context with the complete alternating conversation", () => {
    expect(validateAiChatRequest(validRequest)).toEqual(validRequest);
  });

  it("rejects broken conversation order and an assistant final message", () => {
    expect(() => validateAiChatRequest({ ...validRequest, messages: [{ role: "assistant", content: "Cześć" }] })).toThrow("順序");
    expect(() => validateAiChatRequest({ ...validRequest, messages: validRequest.messages.slice(0, 2) })).toThrow("最後");
  });

  it("keeps page context as reference data in the tutor instructions", () => {
    const instructions = buildAiTutorInstructions(validRequest.context);
    expect(instructions).toContain("モードを固定しない");
    expect(instructions).toContain("問題: Dzień dobry");
    expect(instructions).toContain("参照データ");
    expect(instructions).toContain("Markdownの記号は使わない");
    expect(instructions).toContain("<polish>");
  });

  it("separates tagged Polish phrases for pronunciation controls", () => {
    expect(parseAiTutorMessage("挨拶は <polish>Dzień dobry</polish> です。<polish>Do widzenia!</polish> も使えます。")).toEqual([
      { kind: "text", content: "挨拶は " },
      { kind: "polish", content: "Dzień dobry" },
      { kind: "text", content: " です。" },
      { kind: "polish", content: "Do widzenia!" },
      { kind: "text", content: " も使えます。" },
    ]);
  });

  it("keeps malformed or untagged output visible as plain text", () => {
    expect(parseAiTutorMessage("Dzień dobry")).toEqual([{ kind: "text", content: "Dzień dobry" }]);
    expect(parseAiTutorMessage("例: <polish>Dzień dobry")).toEqual([{ kind: "text", content: "例: <polish>Dzień dobry" }]);
  });

  it("extracts all assistant output text blocks", () => {
    expect(extractOpenAiResponseText({ output: [{ type: "message", content: [{ type: "output_text", text: "Dzień dobry!" }, { type: "output_text", text: "こんにちは！" }] }] })).toBe("Dzień dobry!\nこんにちは！");
  });
});

describe("AI page context", () => {
  it("changes its session key when the app page changes", () => {
    const status = {
      unit: { unitNumber: 1, titleJa: "最初の会話", titlePl: "Pierwsza rozmowa" },
      progress: { completedLessons: 1, dueReviews: 2 },
      nextLesson: { titleJa: "挨拶", titlePl: "Powitania", description: "挨拶を練習" },
      nextMission: { title: "店で挨拶", scenario: "店", learnerRole: "客", partnerRole: "店員", requiredExpressions: ["Dzień dobry"], partnerExpressions: ["Słucham?"] },
    } as StatusResponse;
    expect(buildAppAiContext(status, "today", "A1").key).toBe("app:today:A1");
    expect(buildAppAiContext(status, "review", "A1").key).toBe("app:review:A1");
  });
});
