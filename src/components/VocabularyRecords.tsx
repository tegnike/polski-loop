import type { VocabularySummary } from "../lib/types";
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

export default function VocabularyRecords({ summary, onLegacy }: VocabularyRecordsProps) {
  return (
    <div className="vocab-page">
      <section className="vocab-page-intro"><p className="vocab-eyebrow">Twoje postępy</p><h1>単語の記録</h1><p className="vocab-muted">覚えた言葉と、次に思い出す言葉。</p></section>
      <dl className="vocab-record-metrics">
        <div><dt>学習した単語</dt><dd>{summary.started}<small> / {summary.total}語</small></dd></div>
        <div><dt>覚えている単語</dt><dd>{summary.remembered}<small>語</small></dd></div>
        <div><dt>復習する時期</dt><dd>{summary.due}<small>語</small></dd></div>
      </dl>
      <p className="vocab-help">「わかった」「もう一度」の自己評価による記録です。テストの正解率ではありません。</p>
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
