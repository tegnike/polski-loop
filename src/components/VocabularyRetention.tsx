import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { VocabularyRetentionSummary, VocabularyRetentionWord, VocabularyTestAttempt, VocabularyTestMode } from "../lib/types";
import "./vocabulary.css";

type StartTest = (mode: VocabularyTestMode, wordId?: string) => void;
const stageDays = [0, 1, 3, 7];

export function vocabularyTestDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時を確認できませんでした";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(date);
}

export function vocabularyGapDays(value: number): string {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
}

export function vocabularyRetentionLabel(word?: VocabularyRetentionWord): string {
  if (!word || word.lastCorrect === null) return "未確認";
  if (word.lastCorrect === false) return "再確認";
  return word.stage === 0 ? "未確認" : `${stageDays[word.stage]}日後正解`;
}

export function VocabularyRetentionBadge({ word }: { word?: VocabularyRetentionWord }) {
  const label = vocabularyRetentionLabel(word);
  return <span className={`vocab-retention-badge${word?.lastCorrect === false ? " vocab-retention-recheck" : word && word.stage > 0 ? " vocab-retention-confirmed" : ""}`}>テスト：{label}</span>;
}

export function VocabularyRetentionCard({ summary, learnedWords, onTest }: { summary: VocabularyRetentionSummary; learnedWords: number; onTest: StartTest }) {
  return (
    <section className="vocab-retention-card" aria-labelledby="vocab-retention-home-heading">
      <div className="vocab-section-heading"><h2 id="vocab-retention-home-heading">日を空けて確認</h2><span className="vocab-muted">{summary.due}語が確認の時期</span></div>
      <p className="vocab-retention-copy">日本語の意味から、ヒントなしでポーランド語を声に出して答えます。1日 → 3日 → 7日と間隔を空けて確かめましょう。</p>
      <div className="vocab-retention-actions">
        <button className="vocab-button vocab-primary" type="button" disabled={summary.due === 0} onClick={() => onTest("due")}>日を空けてテストする{summary.due > 0 ? `（${summary.due}語）` : ""}</button>
        <button className="vocab-button vocab-secondary" type="button" disabled={learnedWords === 0} onClick={() => onTest("practice")}>今すぐ練習する</button>
      </div>
      <p className="vocab-progress-explanation">今すぐの練習結果は記録しますが、日を空けた確認には含めません。</p>
    </section>
  );
}

export function RetentionWord({ word, onTest, firstMasteredAt, needsRecheck }: { word: VocabularyRetentionWord; onTest?: StartTest; firstMasteredAt?: string; needsRecheck?: boolean }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<VocabularyTestAttempt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api.vocabularyTestHistory(word.wordId)
      .then((attempts) => { if (!cancelled) setHistory([...attempts].sort((left, right) => right.testedAt.localeCompare(left.testedAt))); })
      .catch((failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : "テスト履歴を読み込めませんでした。"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, word.wordId, word.totalAttempts, word.lastTestAt, retry]);

  return (
    <li>
      <details className="vocab-retention-word" onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary><span><strong lang="pl">{word.polish}</strong><small>{word.meaningJa}</small>{firstMasteredAt && <small className="vocab-mastery-registration">初回登録 <time dateTime={firstMasteredAt}>{vocabularyTestDate(firstMasteredAt)}</time></small>}</span>{firstMasteredAt ? <span className={`vocab-retention-badge ${needsRecheck ? "vocab-retention-recheck" : "vocab-retention-confirmed"}`}>{needsRecheck ? "再確認が必要" : "7日後まで確認済み"}</span> : <VocabularyRetentionBadge word={word} />}</summary>
        <div className="vocab-retention-word-body">
          <dl className="vocab-retention-word-facts">
            {firstMasteredAt && <div><dt>初回登録</dt><dd><time dateTime={firstMasteredAt}>{vocabularyTestDate(firstMasteredAt)}</time></dd></div>}
            {firstMasteredAt && <div><dt>現在の確認状況</dt><dd>{needsRecheck ? "再確認が必要です。累計登録には残ります。" : "7日後まで確認済みです。次の予定でまた確かめます。"}</dd></div>}
            <div><dt>日を空けた確認</dt><dd>{vocabularyRetentionLabel(word)}</dd></div>
            <div><dt>最後の正誤</dt><dd>{word.lastCorrect === null ? "テストはまだです" : word.lastCorrect ? "正解" : "不正解"}</dd></div>
            <div><dt>空けた日数</dt><dd>{word.lastGapDays === null ? "記録はまだです" : vocabularyGapDays(word.lastGapDays) + "日"}</dd></div>
            <div><dt>最後のテスト</dt><dd>{word.lastTestAt ? <time dateTime={word.lastTestAt}>{vocabularyTestDate(word.lastTestAt)}</time> : "まだ受けていません"}</dd></div>
            <div><dt>次の確認</dt><dd><time dateTime={word.nextTestAt}>{vocabularyTestDate(word.nextTestAt)}</time><small>（{word.requiredDays}日空けて確認）</small></dd></div>
          </dl>
          {onTest && <button className="vocab-button vocab-secondary" type="button" onClick={() => onTest("practice", word.wordId)}>この単語を今すぐ確認</button>}
          <h3>テストの履歴</h3>
          {loading ? <p className="vocab-muted" role="status">履歴を読み込んでいます…</p> : error ? <div><p className="vocab-error" role="alert">{error}</p><button className="vocab-text-button" type="button" onClick={() => setRetry((value) => value + 1)}>もう一度読み込む</button></div> : history?.length === 0 ? <p className="vocab-muted">この単語のテストはまだありません。</p> : history && <ol className="vocab-test-history" role="list">
            {history.map((attempt) => <li key={attempt.id}>
              <div><strong className={attempt.isCorrect ? "vocab-test-correct" : "vocab-test-incorrect"}>{attempt.isCorrect ? "正解" : "不正解"}</strong><time dateTime={attempt.testedAt}>{vocabularyTestDate(attempt.testedAt)}</time></div>
              <p>回答：<span lang="pl">{attempt.answer || "（空欄）"}</span></p>
              <p>空けた日数：{vocabularyGapDays(attempt.gapDays)}日 · 確認の基準：{attempt.requiredDays}日</p>
              <p>{!attempt.isCorrect ? "再確認：1日後にもう一度" : attempt.countsForRetention ? attempt.requiredDays === 30 ? "30日空けても正解。次の確認を継続。" : `${stageDays[attempt.stageAfter]}日後確認済み` : "必要な間隔を空けた確認には含みません。次の予定で再確認します。"}</p>
              <p>次の確認：<time dateTime={attempt.nextTestAt}>{vocabularyTestDate(attempt.nextTestAt)}</time></p>
            </li>)}
          </ol>}
        </div>
      </details>
    </li>
  );
}

export function VocabularyRetentionDetails({ summary, onTest }: { summary: VocabularyRetentionSummary; onTest?: StartTest }) {
  return (
    <section className="vocab-retention-details" aria-labelledby="vocab-retention-records-heading">
      <div className="vocab-section-heading"><h2 id="vocab-retention-records-heading">テストで確かめた記録</h2>{onTest && <button className="vocab-text-button" type="button" disabled={summary.due === 0} onClick={() => onTest("due")}>確認の時期：{summary.due}語 →</button>}</div>
      <p className="vocab-retention-copy">1日 → 3日 → 7日と空けて、ヒントなしで思い出せた時点の記録です。</p>
      <dl className="vocab-retention-counts">
        <div><dt>1日後に確認</dt><dd>{summary.confirmed1}<small>語</small></dd></div>
        <div><dt>3日後に確認</dt><dd>{summary.confirmed3}<small>語</small></dd></div>
        <div><dt>7日後に確認</dt><dd>{summary.confirmed7}<small>語</small></dd></div>
        <div><dt>再確認</dt><dd>{summary.recheck}<small>語</small></dd></div>
      </dl>
      <p className="vocab-progress-explanation">7日後まで確認できた単語は、1日後・3日後の数にも含みます。</p>
      <p className="vocab-progress-explanation">今すぐの練習の正解は、日を空けた確認には加えません。単語を開くと、回答と実際の間隔を追えます。</p>
      {summary.words.length === 0 ? <div className="vocab-empty"><p>まずは単語カードで学習しましょう。</p><p>学習した単語を、1日後からテストで確かめられます。</p></div> : <ul className="vocab-retention-list" role="list">{summary.words.map((word) => <RetentionWord key={word.wordId} word={word} onTest={onTest} />)}</ul>}
    </section>
  );
}
