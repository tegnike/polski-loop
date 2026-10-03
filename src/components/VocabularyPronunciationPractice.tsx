import { useState } from "react";
import { usePolishSpeechInput } from "../lib/use-polish-speech-input";
import { normalizeVocabularyPolish } from "../lib/vocabulary";
import { MicrophoneIcon } from "./PolishSpeechInput";

interface PracticeResult { transcript: string; matches: boolean }

export default function VocabularyPronunciationPractice({ acceptedAnswers }: { acceptedAnswers: string[] }) {
  const [tries, setTries] = useState<PracticeResult[]>([]);
  const speech = usePolishSpeechInput({ onTranscript: (transcript) => {
    const normalize = (value: string) => normalizeVocabularyPolish(value).toLocaleLowerCase("pl-PL");
    setTries((previous) => [...previous, { transcript, matches: acceptedAnswers.some((answer) => normalize(answer) === normalize(transcript)) }]);
  } });
  const busy = speech.state !== "idle";
  const latest = tries.at(-1);

  return <section className="vocab-pronunciation-practice" aria-labelledby="vocab-pronunciation-practice-heading">
    <h3 id="vocab-pronunciation-practice-heading">何度でも発音練習</h3>
    <p>上の再生ボタンでお手本を聞いて、声に出してみましょう。練習は確認段階や次回予定を変えません。</p>
    {speech.supported ? <>
      <button className={`vocab-button vocab-secondary vocab-mic-button${busy ? " is-listening" : ""}`} type="button" disabled={speech.state === "stopping"} onClick={() => busy ? speech.stop() : speech.start()} aria-pressed={busy}>
        {busy ? <span aria-hidden="true">■</span> : <MicrophoneIcon />}
        {speech.state === "stopping" ? "聞き取りを確定しています…" : busy ? "練習の録音を止める" : tries.length ? "もう一度発音する" : "発音を試す"}
      </button>
      {busy && <p className="vocab-practice-live" lang="pl" role="status">{speech.transcript || "ポーランド語で話してください…"}</p>}
      {speech.error && <p className="vocab-error" role="alert">{speech.error}</p>}
      {latest && !busy && !speech.error && <div className={`vocab-practice-result${latest.matches ? " is-match" : ""}`} role="status"><strong>{latest.matches ? "この単語として認識できました" : "別の言葉として聞き取られました"}</strong><p lang="pl">{latest.transcript}</p><small>練習 {tries.length}回 · この単語として認識 {tries.filter((attempt) => attempt.matches).length}回</small></div>}
    </> : <p className="vocab-help">このブラウザでは音声入力を使えません。お手本を聞いて声に出す練習はできます。</p>}
    <p className="vocab-help">音声認識で単語が伝わるかの目安です。発音の細かな良し悪しを採点するものではありません。</p>
  </section>;
}
