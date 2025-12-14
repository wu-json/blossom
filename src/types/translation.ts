export interface WordBreakdown {
  word: string;
  reading: string;
  meaning: string;
  partOfSpeech: string;
}

export interface TranslationData {
  originalText: string;
  subtext: string;
  translation: string;
  breakdown: WordBreakdown[];
  grammarNotes: string;
}

export type ParsedContent =
  | { type: "translation"; data: TranslationData }
  | { type: "text"; data: string }
  | { type: "streaming-translation"; data: null };
