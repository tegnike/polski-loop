import type { VocabularyProgress, VocabularySummary, VocabularyTestMode } from "../lib/types";
import VocabularyProgressCard from "./VocabularyProgressCard";
import { VocabularyMasteryDetails } from "./VocabularyMastery";
import { VocabularyRetentionDetails } from "./VocabularyRetention";
import "./vocabulary.css";

interface VocabularyRecordsProps {
  summary: VocabularySummary;
  onLegacy: () => void;
  onTest?: (mode: VocabularyTestMode, wordId?: string) => void;
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
  const studiedWords = days.reduce((sum, day) => sum + day.words, 0);
  const newWords = days.reduce((sum, day) => sum + day.newWords, 0);
  const previousNewWords = previousDays.reduce((sum, day) => sum + day.newWords, 0);
  const studyDays = days.filter((day) => day.words > 0).length;
  const difference = newWords - previousNewWords;
  const differenceLabel = difference > 0 ? `+${difference}` : difference < 0 ? `−${Math.abs(difference)}` : "±0";
  const maxWords = Math.max(1, ...days.map((day) => day.words));

  return (
    <section className="vocab-week-card" aria-labelledby="vocab-week-heading">
      <div className="vocab-week-heading"><h2 id="vocab-week-heading">直近7日の新しい単語</h2>{days.length > 0 && <strong>{newWords}<small>語</small></strong>}</div>
      {days.length === 0 ? <p className="vocab-muted" role="status">毎日の学習記録を準備しています…</p> : <>
        <p className="vocab-week-period">{activityDate(days[0].date, true)} – {activityDate(days[days.length - 1].date, true)}</p>
        <p className="vocab-week-chart-title">毎日の学習（新しい単語＋復習）</p>
        <ul className="vocab-week-chart" role="list" aria-label="日ごとの学習語数。新しい単語と復習の内訳">
          {days.map((day) => <li key={day.date} aria-label={`${activityDate(day.date)} 学習${day.words}語、新しい単語${day.newWords}語、復習${Math.max(0, day.words - day.newWords)}語`}>
            <span className="vocab-week-value">{day.words}<small>語</small></span>
            <span className="vocab-week-track" aria-hidden="true"><span className="vocab-week-new" style={{ height: `${day.newWords / maxWords * 100}%` }} /><span className="vocab-week-review" style={{ height: `${Math.max(0, day.words - day.newWords) / maxWords * 100}%` }} /></span>
            <time dateTime={day.date}>{activityDate(day.date)}</time>
          </li>)}
        </ul>
        <div className="vocab-week-legend"><span><i className="vocab-week-new" aria-hidden="true" />新しい単語</span><span><i className="vocab-week-review" aria-hidden="true" />復習</span></div>
        {studiedWords === 0 && <p className="vocab-progress-empty">この7日間はまだ学習記録がありません。今日1語から、積み重ねてみましょう。</p>}
        <dl className="vocab-week-summary">
          <div><dt>復習も含む学習</dt><dd><small className="vocab-week-prefix">延べ</small>{studiedWords}<small>語</small></dd></div>
          <div><dt>学習した日</dt><dd>{studyDays}<small> / {days.length}日</small></dd></div>
          <div><dt>新しい単語の差</dt><dd>{differenceLabel}<small>語</small></dd></div>
        </dl>
        {previousDays.length > 0 && <p className="vocab-week-comparison">前の7日（{activityDate(previousDays[0].date)} – {activityDate(previousDays[previousDays.length - 1].date)}）に新しく学んだ単語は{previousNewWords}語でした。</p>}
        <p className="vocab-progress-explanation">日ごとの語数は、新しい単語と復習を合わせた数です。同じ単語は同じ日に1回だけ数えます。7日間の合計は延べ語数です。</p>
      </>}
    </section>
  );
}

export default function VocabularyRecords({ summary, onLegacy, onTest }: VocabularyRecordsProps) {
  return (
    <div className="vocab-page">
      <section className="vocab-page-intro"><p className="vocab-eyebrow">Twoje postępy</p><h1>単語の記録</h1><p className="vocab-muted">これまで学んだ単語、定着の確認、学習の履歴を振り返ります。</p></section>
      {summary.retention?.mastery && <VocabularyMasteryDetails summary={summary.retention.mastery} onTest={onTest} />}
      <VocabularyProgressCard progress={summary.progress} learnedWords={summary.started} totalWords={summary.total} />
      {summary.progress && <VocabularyWeek progress={summary.progress} />}
      {summary.retention && <VocabularyRetentionDetails summary={summary.retention} onTest={onTest} />}
      <section aria-labelledby="vocab-rating-summary-heading">
        <div className="vocab-section-heading"><h2 id="vocab-rating-summary-heading">単語の自己評価</h2></div>
        <dl className="vocab-record-metrics">
          <div><dt>わかった</dt><dd>{summary.remembered}<small>語</small></dd></div>
          <div><dt>もう一度</dt><dd>{Math.max(0, summary.started - summary.remembered)}<small>語</small></dd></div>
        </dl>
        <p className="vocab-help vocab-rating-explanation">「わかった」「もう一度」の自己評価による記録です。テストで定着を確認した単語数とは別です。</p>
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
