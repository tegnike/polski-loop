import { useState } from "react";
import { getPronunciationAudio, playPronunciation, preparePronunciationPlayback } from "../lib/pronunciation";

interface PronunciationButtonProps {
  text: string;
  className?: string;
}

type PlaybackState = "idle" | "loading" | "playing" | "error";

export default function PronunciationButton({ text, className = "" }: PronunciationButtonProps) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [message, setMessage] = useState("");

  async function pronounce() {
    if (state === "loading" || state === "playing") return;
    try {
      preparePronunciationPlayback();
      setState("loading");
      setMessage("音声を合成しています…");
      const audio = await getPronunciationAudio(text);
      setState("playing");
      setMessage(audio.cacheHit ? "保存済み音声を再生中" : "音声を保存して再生中");
      await playPronunciation(audio.blob);
      setState("idle");
      setMessage(audio.cacheHit ? "保存済み音声を再生しました" : "音声を保存しました");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "音声を再生できませんでした。");
    }
  }

  const label = state === "loading"
    ? `${text} の音声を合成中`
    : state === "playing"
      ? `${text} を再生中`
      : `${text} の発音を聞く`;

  return (
    <span className={`pronunciation-control ${className}`.trim()}>
      <button
        type="button"
        className={`pronunciation-button ${state}`}
        aria-label={label}
        title={label}
        disabled={state === "loading" || state === "playing"}
        onClick={() => void pronounce()}
      >
        <span aria-hidden="true">{state === "loading" ? "…" : state === "playing" ? "◼" : "▶"}</span>
      </button>
      <span className="visually-hidden" role={state === "error" ? "alert" : "status"} aria-live="polite">{message}</span>
    </span>
  );
}
