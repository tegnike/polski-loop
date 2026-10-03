import { useEffect, useRef, useState, type RefObject } from "react";
import { usePolishSpeechInput } from "../lib/use-polish-speech-input";

export function MicrophoneIcon() {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>;
}

interface PolishSpeechInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onBlockedChange: (blocked: boolean) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

export default function PolishSpeechInput({ value, onChange, disabled, onBlockedChange, buttonRef }: PolishSpeechInputProps) {
  const speech = usePolishSpeechInput({ onTranscript: onChange });
  const [typing, setTyping] = useState(!speech.supported);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = speech.state !== "idle";

  useEffect(() => { onBlockedChange(busy || (!typing && speech.error !== null)); }, [busy, typing, speech.error, onBlockedChange]);
  useEffect(() => () => onBlockedChange(false), [onBlockedChange]);

  function changeMode() {
    speech.reset();
    onBlockedChange(false);
    if (typing) onChange("");
    setTyping((previous) => !previous);
  }

  function record() {
    if (busy) { speech.stop(); return; }
    onChange("");
    onBlockedChange(true);
    speech.start();
  }

  useEffect(() => {
    if (typing) inputRef.current?.focus({ preventScroll: true });
  }, [typing]);

  return <div className="vocab-speech-answer">
    {!speech.supported && <p className="vocab-help">このブラウザでは音声入力を使えません。音声認識に対応したブラウザで開くか、手入力に切り替えてください。</p>}
    {typing ? <label htmlFor="vocab-test-answer">あなたの回答<input ref={inputRef} id="vocab-test-answer" lang="pl" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={300} disabled={disabled} /></label> : <>
      <button ref={buttonRef} className={`vocab-button vocab-primary vocab-mic-button${busy ? " is-listening" : ""}`} type="button" onClick={record} disabled={disabled || speech.state === "stopping"} aria-pressed={busy}>
        {busy ? <span aria-hidden="true">■</span> : <MicrophoneIcon />}
        {speech.state === "stopping" ? "聞き取りを確定しています…" : speech.state === "starting" ? "マイクを準備中・停止する" : speech.state === "listening" ? "録音を止める" : value ? "もう一度話す" : "声で答える"}
      </button>
      <div className="vocab-speech-transcript" aria-live="polite" aria-atomic="true"><span>聞き取った言葉</span><p lang="pl">{busy ? speech.transcript || "ポーランド語で話してください…" : value || "まだ回答はありません"}</p></div>
      <p className="vocab-help">聞き取りが違うときは、何度でも話し直せます。回答の確認ボタンを押すまで採点しません。</p>
      {speech.error && <div className="vocab-speech-error" role="alert"><p>{speech.error}</p><p>聞き取りの失敗は、不正解として記録しません。</p></div>}
    </>}
    {speech.supported && <button className="vocab-text-button vocab-speech-mode" type="button" disabled={disabled} onClick={changeMode}>{typing ? "声で答える方法に戻る" : "手入力に切り替える"}</button>}
  </div>;
}
