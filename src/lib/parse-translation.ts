import type {
  TranslationData,
  ParsedContent,
  WordBreakdown,
} from "../types/translation";

const TRANSLATION_START = "<<<TRANSLATION_START>>>";
const TRANSLATION_END = "<<<TRANSLATION_END>>>";

export function parseTranslationContent(content: string): ParsedContent {
  const startIdx = content.indexOf(TRANSLATION_START);
  const endIdx = content.indexOf(TRANSLATION_END);

  if (startIdx === -1 || endIdx === -1) {
    return { type: "text", data: content };
  }

  const jsonStr = content
    .slice(startIdx + TRANSLATION_START.length, endIdx)
    .trim();

  try {
    const parsed = JSON.parse(jsonStr);

    if (!isValidTranslation(parsed)) {
      return { type: "text", data: content };
    }

    return { type: "translation", data: parsed as TranslationData };
  } catch {
    return { type: "text", data: content };
  }
}

function isValidTranslation(obj: unknown): obj is TranslationData {
  if (typeof obj !== "object" || obj === null) return false;

  const t = obj as Record<string, unknown>;

  return (
    typeof t.originalText === "string" &&
    typeof t.subtext === "string" &&
    typeof t.translation === "string" &&
    Array.isArray(t.breakdown) &&
    t.breakdown.every(isValidWordBreakdown) &&
    typeof t.grammarNotes === "string"
  );
}

function isValidWordBreakdown(obj: unknown): obj is WordBreakdown {
  if (typeof obj !== "object" || obj === null) return false;

  const w = obj as Record<string, unknown>;

  return (
    typeof w.word === "string" &&
    typeof w.reading === "string" &&
    typeof w.meaning === "string" &&
    typeof w.partOfSpeech === "string"
  );
}

export function hasTranslationMarkers(content: string): {
  hasStart: boolean;
  hasEnd: boolean;
  isComplete: boolean;
} {
  const hasStart = content.includes(TRANSLATION_START);
  const hasEnd = content.includes(TRANSLATION_END);

  return {
    hasStart,
    hasEnd,
    isComplete: hasStart && hasEnd,
  };
}
