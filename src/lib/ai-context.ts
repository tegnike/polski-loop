import type { AiPageContext, StatusResponse, TrackCode } from "./types";

const viewLabels: Record<string, string> = {
  today: "今日",
  review: "復習",
  library: "辞書",
  curriculum: "カリキュラム",
  progress: "進捗",
  history: "全学習履歴",
};

export function buildAppAiContext(status: StatusResponse, view: string, activeTrack: TrackCode): AiPageContext {
  const label = viewLabels[view] ?? "Polski Loop";
  const lines = [
    `画面: ${label}`,
    `学習トラック: ${activeTrack}`,
    `現在のUnit: ${status.unit.unitNumber} ${status.unit.titleJa} / ${status.unit.titlePl}`,
    `完了レッスン: ${status.progress.completedLessons}`,
    `期限到来の復習: ${status.progress.dueReviews}`,
    `今日の推奨: ${status.progress.dueReviews > 0 ? "期限到来の復習を先に行う" : "次のレッスンを進める"}`,
  ];

  if (view === "today" || view === "curriculum") {
    lines.push(
      `次のレッスン: ${status.nextLesson.titleJa} / ${status.nextLesson.titlePl}`,
      `レッスン説明: ${status.nextLesson.description}`,
      `次のVoice mission: ${status.nextMission.title}`,
      `場面: ${status.nextMission.scenario}`,
      `学習者の役割: ${status.nextMission.learnerRole}`,
      `相手の役割: ${status.nextMission.partnerRole}`,
      `必須表現: ${status.nextMission.requiredExpressions.join(" / ")}`,
      `相手側の表現: ${status.nextMission.partnerExpressions.join(" / ")}`,
    );
  }
  if (view === "review") lines.push("この画面から期限到来の表現を復習できます。");
  if (view === "library") lines.push("この画面では公開済みの単語、表現、例文、文法項目を検索できます。");
  if (view === "progress") lines.push("この画面では教材完了率、想起成績、Voice採点を確認できます。");
  if (view === "history") lines.push("この画面では回答、学習セッション、Voice採点を時系列で確認できます。");

  return { key: `app:${view}:${activeTrack}`, label, content: lines.join("\n") };
}
