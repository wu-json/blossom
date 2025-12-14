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

// Partial versions for streaming
export interface PartialWordBreakdown {
  word?: string;
  reading?: string;
  meaning?: string;
  partOfSpeech?: string;
}

export interface PartialTranslationData {
  originalText?: string;
  subtext?: string;
  translation?: string;
  breakdown?: PartialWordBreakdown[];
  grammarNotes?: string;
  _streaming?: {
    currentField?: string;
    isComplete?: boolean;
  };
}

export type ParsedContent =
  | { type: "translation"; data: TranslationData }
  | { type: "text"; data: string }
  | { type: "streaming-translation"; data: null }
  | { type: "streaming-partial"; data: PartialTranslationData };
