import { useId } from "react";
import type { VocabularyMasterySummary, VocabularyTestMode } from "../lib/types";
import { RetentionWord } from "./VocabularyRetention";
import "./vocabulary.css";

interface VocabularyMasteryProps {
  summary: VocabularyMasterySummary;
}

function MasterySteps() {
  return <ol className="vocab-mastery-steps" aria-label="定着を記録するまでの流れ">
    <li><span aria-hidden="true">1</span>毎日覚える</li>
    <li><span aria-hidden="true">2</span>日を空けてテスト</li>
    <li><span aria-hidden="true">3</span>定着の記録</li>
  </ol>;
}

function MasteryCount({ summary }: VocabularyMasteryProps) {
  return <div className="vocab-mastery-count"><strong>{summary.total}<small>語</small></strong><span>これまでの累計登録</span></div>;
}

export function VocabularyMasteryDetails({ summary, onTest }: VocabularyMasteryProps & { onTest?: (mode: VocabularyTestMode, wordId?: string) => void }) {
  const headingId = useId();
  const words = [...summary.words].sort((left, right) => right.firstMasteredAt.localeCompare(left.firstMasteredAt) || left.wordId.localeCompare(right.wordId));
  return <section id="vocab-mastery-records" className="vocab-mastery-details" aria-labelledby={headingId} tabIndex={-1}>
    <div className="vocab-mastery-card">
      <h2 id={headingId}>定着した単語</h2>
      <MasteryCount summary={summary} />
      <p className="vocab-mastery-criteria">1日・3日・7日と間隔を空けたテストに正解すると登録されます。</p>
      <MasterySteps />
      <dl className="vocab-mastery-current">
        <div><dt>7日後まで確認済み</dt><dd>{summary.verified}<small>語</small></dd></div>
        <div><dt>累計のうち再確認</dt><dd>{summary.recheck}<small>語</small></dd></div>
      </dl>
      <p className="vocab-progress-explanation">7日後まで確認できた単語も、30日後にもう一度確かめます。忘れていても累計と初回登録日は残し、再確認として表示します。今後も思い出せるか、テストを続けましょう。</p>
    </div>
    {words.length === 0 ? <div className="vocab-empty"><p>定着した単語の登録は、まだありません。</p><p>自己評価とは別に、日を空けたテストで確認できた単語をここに残します。</p></div> : <>
      <p className="vocab-mastery-list-help">登録の新しい順です。単語を開くと、次の予定とテストの履歴を確認できます。</p>
      <ul className="vocab-retention-list vocab-mastery-list" role="list">{words.map((word) => <RetentionWord key={word.wordId} word={word} firstMasteredAt={word.firstMasteredAt} needsRecheck={word.needsRecheck} onTest={onTest} />)}</ul>
    </>}
  </section>;
}
