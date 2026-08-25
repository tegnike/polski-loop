import {
  normalizePronunciationText,
  resolveSpeakerGender,
  selectPolishVoice,
  type SpeakerGender,
} from "./pronunciation-config";

const PRONUNCIATION_CACHE = "polski-loop-pronunciation-v2";
const ENGINE_VERSION = "google-chirp3-hd-v1";

let audioContext: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let persistenceRequested = false;

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
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
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
  if (!audioContext) throw new Error("音声を再生できません。");

  const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
  activeSource?.stop();
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  activeSource = source;
  await new Promise<void>((resolve) => {
    source.addEventListener("ended", () => {
      if (activeSource === source) activeSource = null;
      resolve();
    }, { once: true });
    source.start();
  });
}
