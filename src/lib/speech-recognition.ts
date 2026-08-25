export const SPEECH_INPUT_LANGUAGES = [
  { value: "ja-JP", label: "日本語" },
  { value: "pl-PL", label: "Polski" },
] as const;

export type SpeechInputLanguage = (typeof SPEECH_INPUT_LANGUAGES)[number]["value"];

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionResultEventLike extends Event {
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function transcriptFromResults(event: SpeechRecognitionResultEventLike): string {
  const transcripts: string[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    const transcript = event.results[index]?.[0]?.transcript.trim();
    if (transcript) transcripts.push(transcript);
  }
  return transcripts.join(" ");
}

export function appendSpeechTranscript(baseDraft: string, transcript: string, maxLength = 8_000): string {
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return baseDraft.slice(0, maxLength);
  const separator = baseDraft.length > 0 && !/\s$/u.test(baseDraft) ? " " : "";
  return `${baseDraft}${separator}${normalizedTranscript}`.slice(0, maxLength);
}

export function speechRecognitionErrorMessage(error: string): string | null {
  switch (error) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "音声入力が許可されていません。ブラウザのマイク権限を確認してください。";
    case "audio-capture":
      return "マイクを使用できません。端末やブラウザのマイク設定を確認してください。";
    case "no-speech":
      return "音声を聞き取れませんでした。もう一度マイクを押して話してください。";
    case "language-not-supported":
      return "選択した言語の音声認識に、このブラウザは対応していません。";
    case "network":
      return "音声認識サービスに接続できませんでした。通信状態を確認してください。";
    default:
      return "音声を文字に変換できませんでした。もう一度お試しください。";
  }
}
