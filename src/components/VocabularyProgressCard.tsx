import { useId } from "react";
import type { VocabularyProgress } from "../lib/types";
import "./vocabulary.css";

interface VocabularyProgressCardProps {
  progress?: VocabularyProgress;
  learnedWords: number;
  totalWords: number;
}

export default function VocabularyProgressCard({ progress, learnedWords, totalWords }: VocabularyProgressCardProps) {
  const headingId = useId();
  const remainingWords = Math.max(0, totalWords - learnedWords);
  const coverage = totalWords > 0 ? Math.min(100, learnedWords / totalWords * 100) : 0;

  return (
    <section className="vocab-progress-card" aria-labelledby={headingId}>
      <div className="vocab-progress-heading">
        <h2 id={headingId}>これまで学習した単語</h2>
      </div>
      <div className="vocab-coverage-progress">
        <strong className="vocab-learned-count">{learnedWords}<small> / {totalWords}語</small></strong>
        <div className="vocab-word-track" role="progressbar" aria-label="単語帳全体の学習状況" aria-valuemin={0} aria-valuemax={Math.max(1, totalWords)} aria-valuenow={Math.min(learnedWords, totalWords)} aria-valuetext={`全${totalWords}語のうち${learnedWords}語を学習、未学習はあと${remainingWords}語`}>
          <span style={{ width: `${coverage}%` }} />
        </div>
        <p className="vocab-remaining-words">未学習はあと{remainingWords}語</p>
      </div>
      {progress ? <dl className="vocab-progress-totals">
        <div><dt>連続学習</dt><dd>{progress.currentStreak}<small>日</small></dd></div>
        <div><dt>最長の連続学習</dt><dd>{progress.longestStreak}<small>日</small></dd></div>
        <div><dt>学習した日</dt><dd>{progress.totalStudyDays}<small>日</small></dd></div>
      </dl> : <p className="vocab-muted" role="status">学習記録を読み込んでいます…</p>}
      <p className="vocab-progress-explanation">同じ単語を別の日に復習しても、学習済みの総単語数は増えません。</p>
    </section>
  );
}
