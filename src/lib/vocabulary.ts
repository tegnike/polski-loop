import type { VocabularyTopic } from "./types";

export const VOCABULARY_TOPICS: Array<Pick<VocabularyTopic, "id" | "label" | "icon">> = [
  { id: "supermarket", label: "スーパー", icon: "basket" },
  { id: "cafe", label: "カフェ・外食", icon: "coffee" },
  { id: "transport", label: "移動", icon: "train" },
  { id: "home", label: "家の中", icon: "home" },
  { id: "health", label: "体調・薬局", icon: "heart" },
  { id: "errands", label: "用事・手続き", icon: "briefcase" },
  { id: "people", label: "人・気持ち", icon: "people" },
  { id: "time", label: "時間・数字", icon: "clock" },
];

export function isVocabularyTopic(value: string): boolean {
  return VOCABULARY_TOPICS.some((topic) => topic.id === value);
}

export function normalizeVocabularyPolish(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

const vocabularyDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
});

export function vocabularyDateKey(value: string | Date): string {
  const parts = vocabularyDateFormatter.formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
