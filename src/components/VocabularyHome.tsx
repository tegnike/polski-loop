import type { VocabularyStudyRequest, VocabularySummary, VocabularyWord } from "../lib/types";
import PronunciationButton from "./PronunciationButton";
import VocabularyProgressCard from "./VocabularyProgressCard";
import "./vocabulary.css";

interface VocabularyHomeProps {
  summary: VocabularySummary;
  onStart: (request: VocabularyStudyRequest) => void;
  onLibrary: (topic?: string) => void;
  onLegacy: () => void;
  onAdd: () => void;
  onRecords: () => void;
}

function wordState(word: VocabularyWord): string {
  if (!word.state) return "未学習";
  if (word.state.lastRating === "again") return "もう一度";
  return Date.parse(word.state.dueAt) <= Date.now() ? "復習する時期" : "わかった";
}

function TopicIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    basket: "M3 9h18l-2 11H5L3 9Zm4 0 5-6 5 6M9 12v5m6-5v5",
    coffee: "M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v2m4-2v2m4-2v2",
    train: "M7 3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm-3 8h16M8 15h1m6 0h1M8 19l-2 3m10-3 2 3M12 3v8",
    home: "M2 11 12 3l10 8M5 9v12h14V9M9 21v-7h6v7",
    heart: "M12 21 3.5 12.5a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7L12 21Z",
    briefcase: "M4 7h16a2 2 0 0 1 2 2v11H2V9a2 2 0 0 1 2-2Zm4 0V3h8v4M2 12l10 4 10-4M12 13v4",
    people: "M8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 1a3 3 0 1 1 0 6M2 21v-4a6 6 0 0 1 12 0v4m2-7a5 5 0 0 1 6 5v2",
    clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4v6l4 3",
  };
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] ?? "M4 4h16v16H4V4Z"} /></svg>;
}

export default function VocabularyHome({ summary, onStart, onLibrary, onLegacy, onAdd, onRecords }: VocabularyHomeProps) {
  const today = summary.today.slice(0, 5);

  return (
    <div className="vocab-page">
      <section className="vocab-hero" aria-labelledby="vocab-home-title">
        <p className="vocab-eyebrow">Mały krok, każdego dnia</p>
        <div className="vocab-title-row">
          <h1 id="vocab-home-title">今日の{today.length || ""}単語</h1>
          <span className="vocab-daily-count">今日は{summary.learnedToday}語を学習</span>
        </div>
        <p className="vocab-muted">生活で使う言葉を、少しずつ。</p>
        <button className="vocab-button vocab-primary" type="button" onClick={() => today.length > 0 ? onStart({ mode: "learn" }) : onLibrary()} disabled={summary.total === 0}>
          <span>{today.length > 0 ? "単語を覚える" : "場面から単語を選ぶ"} <span aria-hidden="true">→</span></span>
          <small>{today.length > 0 ? "1回、最大5語" : "単語帳へ"}</small>
        </button>
        <button className="vocab-quiet vocab-review-link" type="button" onClick={() => onStart({ mode: "review" })} disabled={summary.due === 0}>
          <span aria-hidden="true">↻</span> {summary.due > 0 ? `${summary.due}語を復習する` : "今は期限到来の復習なし"}
        </button>
      </section>

      <VocabularyProgressCard progress={summary.progress} compact onRecords={onRecords} />

      <section aria-labelledby="vocab-today-heading">
        <div className="vocab-section-heading">
          <h2 id="vocab-today-heading">今日の単語</h2>
          <button className="vocab-text-button" type="button" onClick={() => onLibrary()}>単語帳を見る <span aria-hidden="true">›</span></button>
        </div>
        {today.length > 0 ? (
          <div className="vocab-preview-list">
            {today.map((word) => (
              <div className="vocab-preview-row" key={word.id}>
                <button className="vocab-word-link" type="button" onClick={() => onStart({ mode: "learn", wordId: word.id })} aria-label={`${word.polish}・${word.meaningJa}のカードを開く`}>
                  <span className="vocab-preview-polish" lang="pl">{word.polish}</span>
                  <span className="vocab-preview-meta"><span>{word.meaningJa}</span><small>{wordState(word)}</small></span>
                </button>
                <PronunciationButton text={word.polish} speakerGender={word.speakerGender} />
              </div>
            ))}
          </div>
        ) : (
          <div className="vocab-empty"><p>新しい単語はひと区切りです。</p><p>場面から選ぶか、見かけた単語を追加してみましょう。</p></div>
        )}
      </section>

      <section aria-labelledby="vocab-topics-heading">
        <div className="vocab-section-heading"><h2 id="vocab-topics-heading">場面から選ぶ</h2><span className="vocab-muted">暮らしの単語</span></div>
        <div className="vocab-topic-grid">
          {summary.topics.map((topic) => (
            <button className="vocab-topic" type="button" key={topic.id} onClick={() => onLibrary(topic.id)}>
              <span className="vocab-topic-icon" aria-hidden="true"><TopicIcon name={topic.icon} /></span>
              <span><strong>{topic.label}</strong><small>{topic.started} / {topic.total}語を学習</small></span>
              <span className="vocab-topic-arrow" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>

      <button className="vocab-add-button" type="button" onClick={onAdd}>＋ 見かけた単語を追加</button>
      <button className="vocab-legacy-link" type="button" onClick={onLegacy}>例文・レッスンも見る <span aria-hidden="true">›</span></button>
    </div>
  );
}
