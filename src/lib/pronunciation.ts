const PRONUNCIATION_CACHE = "polski-loop-pronunciation-v1";
const ENGINE_VERSION = "espeak-ng-1.0.2";
const VOICE = "pl";
const SPEED = 145;
const PITCH = 48;

let audioContext: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let persistenceRequested = false;

interface ESpeakModule {
  FS: { readFile(path: string): Uint8Array };
}

type CreateESpeak = (options: { arguments: string[] }) => Promise<ESpeakModule>;

export interface PronunciationAudio {
  blob: Blob;
  cacheHit: boolean;
}

export function normalizePronunciationText(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function pronunciationCachePath(text: string): string {
  const normalized = normalizePronunciationText(text);
  return `/__pronunciation-cache/${ENGINE_VERSION}/${VOICE}/${SPEED}/${PITCH}/${encodeURIComponent(normalized)}`;
}

function cacheRequest(text: string): Request {
  return new Request(new URL(pronunciationCachePath(text), window.location.origin), { method: "GET" });
}

async function synthesize(text: string): Promise<Blob> {
  // The package ships ESM/WASM without TypeScript declarations.
  // @ts-expect-error espeak-ng has no declaration file
  const { default: createESpeak } = await import("espeak-ng") as { default: CreateESpeak };
  const outputName = `pronunciation-${crypto.randomUUID()}.wav`;
  const instance = await createESpeak({
    arguments: ["-v", VOICE, "-s", String(SPEED), "-p", String(PITCH), "-w", outputName, text],
  });
  const audio = instance.FS.readFile(outputName);
  const bytes = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
  return new Blob([bytes], { type: "audio/wav" });
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

export async function getPronunciationAudio(text: string): Promise<PronunciationAudio> {
  const normalized = normalizePronunciationText(text);
  if (!normalized) throw new Error("発音するポーランド語がありません。");

  if ("caches" in window) {
    const cache = await caches.open(PRONUNCIATION_CACHE);
    const request = cacheRequest(normalized);
    const cached = await cache.match(request);
    if (cached) return { blob: await cached.blob(), cacheHit: true };

    const blob = await synthesize(normalized);
    await cache.put(request, new Response(blob, {
      headers: {
        "content-type": blob.type,
        "x-polski-loop-engine": ENGINE_VERSION,
      },
    }));
    return { blob, cacheHit: false };
  }

  return { blob: await synthesize(normalized), cacheHit: false };
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
