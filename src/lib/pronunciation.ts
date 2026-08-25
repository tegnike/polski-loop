import {
  normalizePronunciationText,
  resolveSpeakerGender,
  selectPolishVoice,
  type SpeakerGender,
} from "./pronunciation-config";

const PRONUNCIATION_CACHE = "polski-loop-pronunciation-v2";
const ENGINE_VERSION = "google-chirp3-hd-v1";

let persistenceRequested = false;

interface ActivePlayback {
  audio: HTMLAudioElement;
  finish: (error?: Error) => void;
}

let activePlayback: ActivePlayback | null = null;

export interface PronunciationAudio {
  blob: Blob;
  cacheHit: boolean;
}

export { normalizePronunciationText } from "./pronunciation-config";

export function pronunciationCachePath(text: string, genderHint: SpeakerGender = "any"): string {
  const normalized = normalizePronunciationText(text);
  const gender = resolveSpeakerGender(normalized, genderHint);
  const voice = selectPolishVoice(normalized, gender);
  return `/__pronunciation-cache/${ENGINE_VERSION}/${gender}/${voice.name}/${encodeURIComponent(normalized)}`;
}

function cacheRequest(text: string, genderHint: SpeakerGender): Request {
  return new Request(new URL(pronunciationCachePath(text, genderHint), window.location.origin), { method: "GET" });
}

async function synthesize(text: string, genderHint: SpeakerGender): Promise<Blob> {
  const response = await fetch("/api/v1/pronunciations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, speakerGender: resolveSpeakerGender(text, genderHint) }),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
      ? body.message
      : "音声を合成できませんでした。";
    throw new Error(message);
  }
  return response.blob();
}

function requestPersistentStorage(): void {
  if (persistenceRequested) return;
  persistenceRequested = true;
  void navigator.storage?.persist?.().catch(() => false);
}

export function preparePronunciationPlayback(): void {
  requestPersistentStorage();
}

export async function getPronunciationAudio(text: string, genderHint: SpeakerGender = "any"): Promise<PronunciationAudio> {
  const normalized = normalizePronunciationText(text);
  if (!normalized) throw new Error("発音するポーランド語がありません。");

  if ("caches" in window) {
    const cache = await caches.open(PRONUNCIATION_CACHE);
    const request = cacheRequest(normalized, genderHint);
    const cached = await cache.match(request);
    if (cached) return { blob: await cached.blob(), cacheHit: true };

    const blob = await synthesize(normalized, genderHint);
    await cache.put(request, new Response(blob, {
      headers: {
        "content-type": blob.type,
        "x-polski-loop-engine": ENGINE_VERSION,
      },
    }));
    return { blob, cacheHit: false };
  }

  return { blob: await synthesize(normalized, genderHint), cacheHit: false };
}

export async function playPronunciation(blob: Blob): Promise<void> {
  preparePronunciationPlayback();

  activePlayback?.finish();
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  audio.preload = "auto";
  audio.volume = 1;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
      if (activePlayback?.audio === audio) activePlayback = null;
      if (error) reject(error);
      else resolve();
    };
    const onEnded = () => finish();
    const onError = () => finish(new Error("音声を再生できませんでした。"));

    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    activePlayback = { audio, finish };
    void audio.play().catch(() => finish(new Error("音声を再生できませんでした。")));
  });
}
