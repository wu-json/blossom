import type {
  PartialTranslationData,
  PartialWordBreakdown,
} from "../types/translation";

/**
 * Parse partial JSON for translation data.
 * Works by extracting complete key-value pairs from incomplete JSON.
 */
export function parsePartialTranslation(
  jsonFragment: string
): PartialTranslationData {
  const result: PartialTranslationData = {
    _streaming: { isComplete: false },
  };

  // Extract originalText
  const originalText = extractStringField(jsonFragment, "originalText");
  if (originalText.found) {
    result.originalText = originalText.value;
    if (!originalText.complete) {
      result._streaming!.currentField = "originalText";
    }
  }

  // Extract subtext
  const subtext = extractStringField(jsonFragment, "subtext");
  if (subtext.found) {
    result.subtext = subtext.value;
    if (!subtext.complete) {
      result._streaming!.currentField = "subtext";
    }
  }

  // Extract translation
  const translation = extractStringField(jsonFragment, "translation");
  if (translation.found) {
    result.translation = translation.value;
    if (!translation.complete) {
      result._streaming!.currentField = "translation";
    }
  }

  // Extract breakdown array
  const breakdown = extractBreakdownArray(jsonFragment);
  if (breakdown.items.length > 0 || breakdown.inProgress) {
    result.breakdown = breakdown.items;
    if (breakdown.inProgress) {
      result._streaming!.currentField = "breakdown";
    }
  }

  // Extract grammarNotes
  const grammarNotes = extractStringField(jsonFragment, "grammarNotes");
  if (grammarNotes.found) {
    result.grammarNotes = grammarNotes.value;
    if (!grammarNotes.complete) {
      result._streaming!.currentField = "grammarNotes";
    }
  }

  return result;
}

interface FieldResult {
  found: boolean;
  value?: string;
  complete: boolean;
}

/**
 * Extract a string field from partial JSON.
 * Handles escaped quotes and incomplete strings.
 */
function extractStringField(json: string, fieldName: string): FieldResult {
  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*"`);
  const match = json.match(pattern);

  if (!match || match.index === undefined) {
    return { found: false, complete: false };
  }

  const startIndex = match.index + match[0].length;
  let value = "";
  let i = startIndex;
  let escaped = false;
  let foundClosingQuote = false;

  while (i < json.length) {
    const char = json[i];

    if (escaped) {
      if (char === "n") value += "\n";
      else if (char === "t") value += "\t";
      else if (char === "r") value += "\r";
      else value += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      foundClosingQuote = true;
      break;
    } else {
      value += char;
    }
    i++;
  }

  return {
    found: true,
    value: value,
    complete: foundClosingQuote,
  };
}

interface BreakdownResult {
  items: PartialWordBreakdown[];
  inProgress: boolean;
}

/**
 * Extract breakdown array, including complete objects and partial ones.
 */
function extractBreakdownArray(json: string): BreakdownResult {
  const items: PartialWordBreakdown[] = [];

  const breakdownMatch = json.match(/"breakdown"\s*:\s*\[/);
  if (!breakdownMatch || breakdownMatch.index === undefined) {
    return { items: [], inProgress: false };
  }

  const arrayStart = breakdownMatch.index + breakdownMatch[0].length;
  const arrayContent = json.slice(arrayStart);

  // Find array end
  const arrayEndMatch = arrayContent.match(/\]/);
  const contentToSearch = arrayEndMatch
    ? arrayContent.slice(0, arrayEndMatch.index)
    : arrayContent;

  // Extract complete objects
  const objectPattern = /\{[^{}]*\}/g;
  let match;
  while ((match = objectPattern.exec(contentToSearch)) !== null) {
    const item = parseBreakdownItem(match[0]);
    if (item) {
      items.push(item);
    }
  }

  // Check if there's an incomplete object at the end
  const lastOpenBrace = contentToSearch.lastIndexOf("{");
  const lastCloseBrace = contentToSearch.lastIndexOf("}");
  const inProgress = lastOpenBrace > lastCloseBrace;

  // If there's an incomplete object, try to parse partial fields
  if (inProgress) {
    const partialObject = contentToSearch.slice(lastOpenBrace);
    const partialItem = parsePartialBreakdownItem(partialObject);
    if (partialItem && Object.keys(partialItem).length > 0) {
      items.push(partialItem);
    }
  }

  return { items, inProgress };
}

/**
 * Parse a complete breakdown item object.
 */
function parseBreakdownItem(objectStr: string): PartialWordBreakdown | null {
  try {
    const parsed = JSON.parse(objectStr);
    return {
      word: parsed.word,
      reading: parsed.reading,
      meaning: parsed.meaning,
      partOfSpeech: parsed.partOfSpeech,
    };
  } catch {
    return parsePartialBreakdownItem(objectStr);
  }
}

/**
 * Parse a partial breakdown item (incomplete object).
 */
function parsePartialBreakdownItem(objectStr: string): PartialWordBreakdown {
  const item: PartialWordBreakdown = {};

  const fields = ["word", "reading", "meaning", "partOfSpeech"] as const;
  for (const field of fields) {
    const result = extractStringField(objectStr, field);
    if (result.found && result.value !== undefined) {
      item[field] = result.value;
    }
  }

  return item;
}
