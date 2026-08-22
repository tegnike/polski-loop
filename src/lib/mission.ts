export interface MissionPromptInput {
  missionId: string;
  lessonId: string;
  scenario: string;
  learnerRole: string;
  partnerRole: string;
  difficultyLevel: "A1" | "A2";
  partnerBehavior: string;
  endingCondition: string;
  feedbackFormat: string;
}

export function buildMissionPrompt(input: MissionPromptInput, requiredExpressions: string[], partnerExpressions: string[]): string {
  const required = requiredExpressions.length > 0 ? requiredExpressions.map((value) => `- ${value}`).join("\n") : "- lessonで学んだ表現を3つ";
  const partner = partnerExpressions.length > 0 ? partnerExpressions.map((value) => `- ${value}`).join("\n") : "- 相手の短い質問や返答";
  return [
    "ユーザーはポーランド語の学習者です。",
    "あなたはChatGPT Voiceです。Polski Loopの音声ロールプレイを行います。",
    `場面: ${input.scenario}`,
    `学習者の役割: ${input.learnerRole}`,
    `相手の役割: ${input.partnerRole}`,
    `難易度: ${input.difficultyLevel}`,
    "必須表現（学習者が少なくとも3つ使う）:",
    required,
    "相手側に出してほしい表現・反応:",
    partner,
    `相手の振る舞い: ${input.partnerBehavior}`,
    `終了条件: ${input.endingCondition}`,
    `最後のフィードバック: ${input.feedbackFormat}`,
    "会話中は必要以上に日本語へ切り替えず、聞き返されたら一度だけ短く言い換えてください。",
    "",
    "以下はユーザーから指示があった場合のみ対応してください。",
    "今回の会話内容を次の5項目について、それぞれ1〜5点の整数で採点してください。",
    "1. taskCompletion: 場面の目的と終了条件を達成できたか",
    "2. comprehension: 相手の質問・返答を理解して適切に反応できたか",
    "3. responseAccuracy: 語彙・文法・語形が意味の伝わる正確さだったか",
    "4. targetExpressionUse: 必須表現を文脈に合わせて使えたか",
    "5. interactionFluency: 会話を継続し、必要なら聞き返し・言い換えを使えたか",
    "採点目安: 1=ほぼできない、2=大きな支援が必要、3=支援があれば達成、4=小さな誤りはあるが自立して達成、5=自然かつ正確に達成。",
    "採点結果はMarkdownや説明文を付けず、次の仕様を満たすUTF-8のJSONファイルとして作成してください。",
    `ファイル名: polski-loop-voice-result-${input.missionId}.json`,
    "resultIdには毎回新しいUUIDを、evaluatedAtには採点時点の実際のISO 8601日時を入れてください。例示文をそのまま値として残さないでください。",
    "JSON仕様:",
    JSON.stringify({
      schemaVersion: "polski-loop.voice-result.v1",
      resultId: "UUIDを生成",
      missionId: input.missionId,
      lessonId: input.lessonId,
      evaluatedAt: "ISO 8601形式の日時",
      scores: { taskCompletion: 1, comprehension: 1, responseAccuracy: 1, targetExpressionUse: 1, interactionFluency: 1 },
      evidence: { understoodPartner: false, respondedToPartner: false, usedRepairStrategy: false, neededRestatement: false },
      summary: "日本語で総評",
      strengths: ["良かった点を日本語で最大3件"],
      corrections: [{ original: "ユーザーの発話", suggested: "より自然なポーランド語", reason: "修正理由を日本語で" }],
      nextStep: "次回優先して練習することを日本語で1件",
    }, null, 2),
  ].join("\n");
}
