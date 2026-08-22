import type { VoiceResultImport, VoiceScores } from "./types";

export const VOICE_SCORE_KEYS: Array<keyof VoiceScores> = ["taskCompletion", "comprehension", "responseAccuracy", "targetExpressionUse", "interactionFluency"];

export function validateVoiceResultImport(body: VoiceResultImport): void {
  if (JSON.stringify(body).length > 65536) throw new Error("採点ファイルは64KB以下にしてください。");
  if (body.schemaVersion !== "polski-loop.voice-result.v1") throw new Error("対応していない採点ファイル形式です。");
  if (typeof body.resultId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(body.resultId)) throw new Error("resultIdが不正です。");
  if (typeof body.missionId !== "string" || typeof body.lessonId !== "string") throw new Error("missionIdとlessonIdが必要です。");
  if (typeof body.evaluatedAt !== "string" || Number.isNaN(Date.parse(body.evaluatedAt))) throw new Error("evaluatedAtはISO 8601形式で指定してください。");
  if (!body.scores || VOICE_SCORE_KEYS.some((key) => !Number.isInteger(body.scores[key]) || body.scores[key] < 1 || body.scores[key] > 5)) throw new Error("5つの採点は1から5の整数で指定してください。");
  const evidence = body.evidence;
  if (!evidence || [evidence.understoodPartner, evidence.respondedToPartner, evidence.usedRepairStrategy, evidence.neededRestatement].some((value) => typeof value !== "boolean")) throw new Error("evidenceの4項目は真偽値で指定してください。");
  if (typeof body.summary !== "string" || body.summary.length > 2000 || typeof body.nextStep !== "string" || body.nextStep.length > 1000) throw new Error("summaryまたはnextStepが長すぎます。");
  if (!Array.isArray(body.strengths) || body.strengths.length > 3 || body.strengths.some((value) => typeof value !== "string" || value.length > 500)) throw new Error("strengthsは最大3件です。");
  if (!Array.isArray(body.corrections) || body.corrections.length > 5 || body.corrections.some((value) => !value || typeof value.original !== "string" || typeof value.suggested !== "string" || typeof value.reason !== "string" || value.original.length > 500 || value.suggested.length > 500 || value.reason.length > 500)) throw new Error("correctionsは最大5件の修正情報です。");
}
