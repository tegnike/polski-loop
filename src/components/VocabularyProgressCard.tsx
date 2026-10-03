import { useId } from "react";
import type { VocabularyProgress } from "../lib/types";
import "./vocabulary.css";

interface VocabularyProgressCardProps {
  progress?: VocabularyProgress;
  learnedWords: number;
  totalWords: number;
  compact?: boolean;
  onRecords?: () => void;
}

export default function VocabularyProgressCard({ progress, learnedWords, totalWords, compact = false, onRecords }: VocabularyProgressCardProps) {
  const headingId = useId();
  const todayWords = progress?.activity.find((day) => day.date === progress.today)?.words ?? 0;
  const goal = Math.max(1, progress?.dailyGoal ?? 5);
  const goalWords = Math.min(goal, Math.max(0, todayWords));
  const goalReached = todayWords >= goal;
  const remainingWords = Math.max(0, totalWords - learnedWords);
  const coverage = totalWords > 0 ? Math.min(100, learnedWords / totalWords * 100) : 0;

  return (
    <section className={`vocab-progress-card${compact ? " vocab-progress-compact" : ""}`} aria-labelledby={headingId}>
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
      {progress ? <div className="vocab-progress-daily">
        <div className="vocab-daily-goal">
          <div className="vocab-progress-label"><span>今日の目標</span><strong>{todayWords}<small> / {progress.dailyGoal}語</small></strong></div>
          <div className="vocab-word-track vocab-goal-track" role="progressbar" aria-label="今日の単語学習の目標" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={goalWords} aria-valuetext={`今日は${todayWords}語、目標${progress.dailyGoal}語`}>
            <span style={{ width: `${goalWords / goal * 100}%` }} />
          </div>
          <p>{goalReached ? "今日の目標、達成です。" : todayWords === 0 ? "まず1語から、始めましょう。" : `あと${goal - todayWords}語、少しずつ。`}</p>
        </div>
        <div className="vocab-progress-streak"><span>連続学習</span><strong>{progress.currentStreak}<small>日</small></strong></div>
      </div> : <p className="vocab-muted" role="status">今日の学習記録を読み込んでいます…</p>}
      {!compact && progress && <dl className="vocab-progress-totals">
        <div><dt>最長の連続学習</dt><dd>{progress.longestStreak}<small>日</small></dd></div>
        <div><dt>学習した日</dt><dd>{progress.totalStudyDays}<small>日</small></dd></div>
      </dl>}
      <p className="vocab-progress-explanation">同じ単語を別の日に復習しても、学習済みの総単語数は増えません。</p>
      {onRecords && <button className="vocab-progress-records" type="button" onClick={onRecords}>記録を見る <span aria-hidden="true">→</span></button>}
    </section>
  );
}
