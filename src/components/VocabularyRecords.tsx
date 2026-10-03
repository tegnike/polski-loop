import type { VocabularyProgress, VocabularySummary } from "../lib/types";
import VocabularyProgressCard from "./VocabularyProgressCard";
import "./vocabulary.css";

interface VocabularyRecordsProps {
  summary: VocabularySummary;
  onLegacy: () => void;
}

function reviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function activityDate(value: string, withYear = false): string {
  const date = new Date(value + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { ...(withYear ? { year: "numeric" } as const : {}), month: "numeric", day: "numeric", timeZone: "UTC" }).format(date);
}

function VocabularyWeek({ progress }: { progress: VocabularyProgress }) {
  const activity = [...progress.activity].sort((left, right) => left.date.localeCompare(right.date));
  const days = activity.slice(-7);
  const previousDays = activity.slice(-14, -7);
  const points = days.reduce((sum, day) => sum + day.words, 0);
  const previousPoints = previousDays.reduce((sum, day) => sum + day.words, 0);
  const newWords = days.reduce((sum, day) => sum + day.newWords, 0);
  const studyDays = days.filter((day) => day.words > 0).length;
  const difference = points - previousPoints;
  const differenceLabel = difference > 0 ? `+${difference}` : difference < 0 ? `−${Math.abs(difference)}` : "±0";
  const maxPoints = Math.max(1, ...days.map((day) => day.words));

  return (
    <section className="vocab-week-card" aria-labelledby="vocab-week-heading">
      <div className="vocab-week-heading"><h2 id="vocab-week-heading">直近7日の学習</h2>{days.length > 0 && <strong>{points}<small>pt</small></strong>}</div>
      {days.length === 0 ? <p className="vocab-muted" role="status">毎日の学習記録を準備しています…</p> : <>
        <p className="vocab-week-period">{activityDate(days[0].date, true)} – {activityDate(days[days.length - 1].date, true)}</p>
        <ul className="vocab-week-chart" role="list" aria-label="日ごとの学習ポイント">
          {days.map((day) => <li key={day.date}>
            <span className="vocab-week-value">{day.words}<small>pt</small></span>
            <span className="vocab-week-track" aria-hidden="true"><span style={{ height: `${day.words / maxPoints * 100}%` }} /></span>
            <time dateTime={day.date}>{activityDate(day.date)}</time>
          </li>)}
        </ul>
        {points === 0 && <p className="vocab-progress-empty">この7日間はまだ学習記録がありません。今日1語から、積み重ねてみましょう。</p>}
        <dl className="vocab-week-summary">
          <div><dt>新しい単語</dt><dd>{newWords}<small>語</small></dd></div>
          <div><dt>学習した日</dt><dd>{studyDays}<small> / {days.length}日</small></dd></div>
          <div><dt>前の7日との差</dt><dd>{differenceLabel}<small>pt</small></dd></div>
        </dl>
        {previousDays.length > 0 && <p className="vocab-week-comparison">前の7日（{activityDate(previousDays[0].date)} – {activityDate(previousDays[previousDays.length - 1].date)}）は{previousPoints}ptでした。</p>}
        <p className="vocab-progress-explanation">グラフは、その日に学習した単語のポイントです。新しい単語も、翌日の復習も含みます。</p>
      </>}
    </section>
  );
}

export default function VocabularyRecords({ summary, onLegacy }: VocabularyRecordsProps) {
  return (
    <div className="vocab-page">
      <section className="vocab-page-intro"><p className="vocab-eyebrow">Twoje postępy</p><h1>単語の記録</h1><p className="vocab-muted">覚えた言葉と、次に思い出す言葉。</p></section>
      <VocabularyProgressCard progress={summary.progress} />
      {summary.progress && <VocabularyWeek progress={summary.progress} />}
      <section aria-labelledby="vocab-rating-summary-heading">
        <div className="vocab-section-heading"><h2 id="vocab-rating-summary-heading">単語の自己評価</h2></div>
        <dl className="vocab-record-metrics">
          <div><dt>学習した単語</dt><dd>{summary.started}<small> / {summary.total}語</small></dd></div>
          <div><dt>覚えている単語</dt><dd>{summary.remembered}<small>語</small></dd></div>
          <div><dt>復習する時期</dt><dd>{summary.due}<small>語</small></dd></div>
        </dl>
        <p className="vocab-help vocab-rating-explanation">「わかった」「もう一度」の自己評価による記録です。テストの正解率ではありません。</p>
      </section>
      <section aria-labelledby="vocab-records-heading">
        <div className="vocab-section-heading"><h2 id="vocab-records-heading">最近のカード学習</h2><span className="vocab-muted">自己評価</span></div>
        {summary.recentReviews.length === 0 ? (
          <div className="vocab-empty"><p>カード学習の記録はまだありません。</p><p>単語の意味を確認して評価すると、ここに残ります。</p></div>
        ) : (
          <ul className="vocab-record-list">
            {summary.recentReviews.map((entry) => (
              <li className="vocab-record-row" key={entry.id}>
                <div><strong lang="pl">{entry.polish}</strong><span>{entry.meaningJa}</span><time dateTime={entry.createdAt}>{reviewDate(entry.createdAt)}</time></div>
                <div className="vocab-record-rating"><span className={`vocab-state ${entry.rating === "again" ? "vocab-state-again" : "vocab-state-known"}`}>{entry.rating === "again" ? "もう一度" : "わかった"}</span><small>次回 {reviewDate(entry.dueAt)}</small></div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button className="vocab-button vocab-secondary" type="button" onClick={onLegacy}>例文・レッスンの進捗を見る <span aria-hidden="true">›</span></button>
    </div>
  );
}
