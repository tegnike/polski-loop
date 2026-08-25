export type SpeakerGender = "male" | "female" | "any";

export interface PolishVoice {
  name: string;
  gender: Exclude<SpeakerGender, "any">;
}

export const POLISH_CHIRP3_HD_VOICES: PolishVoice[] = [
  { name: "pl-PL-Chirp3-HD-Achernar", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Achird", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Algenib", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Algieba", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Alnilam", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Aoede", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Autonoe", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Callirrhoe", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Charon", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Despina", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Enceladus", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Erinome", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Fenrir", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Gacrux", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Iapetus", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Kore", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Laomedeia", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Leda", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Orus", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Puck", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Pulcherrima", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Rasalgethi", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Sadachbia", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Sadaltager", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Schedar", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Sulafat", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Umbriel", gender: "male" },
  { name: "pl-PL-Chirp3-HD-Vindemiatrix", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Zephyr", gender: "female" },
  { name: "pl-PL-Chirp3-HD-Zubenelgenubi", gender: "male" },
];

export function normalizePronunciationText(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function inferSpeakerGender(text: string): SpeakerGender {
  const normalized = normalizePronunciationText(text).toLocaleLowerCase("pl-PL");
  if (/\b[\p{L}-]*łam\b/gu.test(normalized)) return "female";
  if (/\b[\p{L}-]*łem\b/gu.test(normalized)) return "male";
  if (/\bjestem\s+(?:gotowa|zmęczona|chora|zadowolona|pewna|polką)\b/gu.test(normalized)) return "female";
  if (/\bjestem\s+(?:gotowy|zmęczony|chory|zadowolony|pewny|polakiem)\b/gu.test(normalized)) return "male";
  return "any";
}

export function resolveSpeakerGender(text: string, hint: SpeakerGender = "any"): SpeakerGender {
  return hint === "any" ? inferSpeakerGender(text) : hint;
}

function stableHash(value: string): number {
  let state = 2166136261;
  for (const character of value) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619) >>> 0;
  }
  return state;
}

export function selectPolishVoice(text: string, hint: SpeakerGender = "any"): PolishVoice {
  const normalized = normalizePronunciationText(text);
  const gender = resolveSpeakerGender(normalized, hint);
  const candidates = gender === "any"
    ? POLISH_CHIRP3_HD_VOICES
    : POLISH_CHIRP3_HD_VOICES.filter((voice) => voice.gender === gender);
  return candidates[stableHash(`${gender}\0${normalized}`) % candidates.length];
}
