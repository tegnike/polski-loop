import { useId } from "react";
import type { VocabularyProgress } from "../lib/types";
import "./vocabulary.css";

interface VocabularyProgressCardProps {
  progress?: VocabularyProgress;
  compact?: boolean;
  onRecords?: () => void;
}

export default function VocabularyProgressCard({ progress, compact = false, onRecords }: VocabularyProgressCardProps) {
  const headingId = useId();

  if (!progress) {
    return (
      <section className="vocab-progress-card" aria-labelledby={headingId}>
        <h2 id={headingId}>学習の積み重ね</h2>
        <p className="vocab-muted" role="status">学習の記録を読み込んでいます…</p>
      </section>
    );
  }

  const todayWords = progress.activity.find((day) => day.date === progress.today)?.words ?? 0;
  const goal = Math.max(1, progress.dailyGoal);
  const levelSize = Math.max(1, progress.pointsPerLevel);
  const levelPoints = Math.min(levelSize, Math.max(0, progress.pointsIntoLevel));
  const goalPoints = Math.min(goal, Math.max(0, todayWords));
  const goalReached = todayWords >= goal;

  return (
    <section className={`vocab-progress-card${compact ? " vocab-progress-compact" : ""}`} aria-labelledby={headingId}>
      <div className="vocab-progress-heading">
        <div><h2 id={headingId}>学習レベル</h2><p>毎日の積み重ねが、少しずつ形に。</p></div>
        <strong className="vocab-level-badge"><small>Lv.</small>{progress.level}</strong>
      </div>
      <div className="vocab-level-progress">
        <div className="vocab-progress-label"><span>Lv.{progress.level + 1}まであと{progress.pointsToNextLevel}pt</span><small>{progress.pointsIntoLevel} / {progress.pointsPerLevel}pt</small></div>
        <div className="vocab-points-track" role="progressbar" aria-label="次の学習レベルまでの進捗" aria-valuemin={0} aria-valuemax={levelSize} aria-valuenow={levelPoints} aria-valuetext={`${progress.pointsIntoLevel}ポイント、次のレベルまであと${progress.pointsToNextLevel}ポイント`}>
          <span style={{ width: `${levelPoints / levelSize * 100}%` }} />
        </div>
      </div>
      <div className="vocab-progress-daily">
        <div className="vocab-daily-goal">
          <div className="vocab-progress-label"><span>今日の目標</span><strong>{todayWords}<small> / {progress.dailyGoal}語</small></strong></div>
          <div className="vocab-points-track vocab-goal-track" role="progressbar" aria-label="今日の単語学習の目標" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={goalPoints} aria-valuetext={`今日は${todayWords}語、目標${progress.dailyGoal}語`}>
            <span style={{ width: `${goalPoints / goal * 100}%` }} />
          </div>
          <p>{goalReached ? "今日の目標、達成です。" : todayWords === 0 ? "まず1語から、始めましょう。" : `あと${goal - todayWords}語、少しずつ。`}</p>
        </div>
        <div className="vocab-progress-streak"><span>連続学習</span><strong>{progress.currentStreak}<small>日</small></strong></div>
      </div>
      {!compact && <dl className="vocab-progress-totals">
        <div><dt>累計ポイント</dt><dd>{progress.totalPoints}<small>pt</small></dd></div>
        <div><dt>最長の連続学習</dt><dd>{progress.longestStreak}<small>日</small></dd></div>
        <div><dt>学習した日</dt><dd>{progress.totalStudyDays}<small>日</small></dd></div>
      </dl>}
      <p className="vocab-progress-explanation">同じ単語は1日1pt。翌日の復習も加算。{progress.pointsPerLevel}ptごとに学習レベルアップ。</p>
      {onRecords && <button className="vocab-progress-records" type="button" onClick={onRecords}>記録を見る <span aria-hidden="true">→</span></button>}
    </section>
  );
}
