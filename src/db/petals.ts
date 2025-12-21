import { db } from "./database";

export interface PetalRow {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  part_of_speech: string;
  language: string;
  conversation_id: string;
  message_id: string;
  user_input: string;
  user_images: string | null;
  created_at: number;
  source_type: string;
  youtube_translation_id: string | null;
}

export interface FlowerData {
  word: string;
  petalCount: number;
  latestReading: string;
  latestMeaning: string;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function createPetal(
  word: string,
  reading: string,
  meaning: string,
  partOfSpeech: string,
  language: string,
  conversationId: string,
  messageId: string,
  userInput: string,
  userImages?: string[],
  sourceType: string = "chat",
  youtubeTranslationId?: string
): PetalRow {
  const id = generateId();
  const createdAt = Date.now();
  const userImagesJson = userImages && userImages.length > 0 ? JSON.stringify(userImages) : null;

  db.run(
    `INSERT INTO petals (id, word, reading, meaning, part_of_speech, language, conversation_id, message_id, user_input, user_images, created_at, source_type, youtube_translation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, word, reading, meaning, partOfSpeech, language, conversationId, messageId, userInput, userImagesJson, createdAt, sourceType, youtubeTranslationId || null]
  );

  return {
    id,
    word,
    reading,
    meaning,
    part_of_speech: partOfSpeech,
    language,
    conversation_id: conversationId,
    message_id: messageId,
    user_input: userInput,
    user_images: userImagesJson,
    created_at: createdAt,
    source_type: sourceType,
    youtube_translation_id: youtubeTranslationId || null,
  };
}

export function getPetalsByLanguage(language: string): PetalRow[] {
  return db.query<PetalRow, [string]>(
    "SELECT * FROM petals WHERE language = ? ORDER BY created_at DESC"
  ).all(language) as PetalRow[];
}

export function getPetalsByWordAndLanguage(word: string, language: string): PetalRow[] {
  return db.query<PetalRow, [string, string]>(
    "SELECT * FROM petals WHERE word = ? AND language = ? ORDER BY created_at DESC"
  ).all(word, language) as PetalRow[];
}

export function getPetalById(id: string): PetalRow | null {
  return db.query<PetalRow, [string]>(
    "SELECT * FROM petals WHERE id = ?"
  ).get(id) as PetalRow | null;
}

export function deletePetal(id: string): void {
  db.run("DELETE FROM petals WHERE id = ?", [id]);
}

export function getFlowersByLanguage(language: string): FlowerData[] {
  return db.query<FlowerData, [string, string, string]>(
    `SELECT
       word,
       COUNT(*) as petalCount,
       (SELECT reading FROM petals p2 WHERE p2.word = petals.word AND p2.language = ? ORDER BY created_at DESC LIMIT 1) as latestReading,
       (SELECT meaning FROM petals p2 WHERE p2.word = petals.word AND p2.language = ? ORDER BY created_at DESC LIMIT 1) as latestMeaning
     FROM petals
     WHERE language = ?
     GROUP BY word
     ORDER BY MAX(created_at) DESC`
  ).all(language, language, language) as FlowerData[];
}

export function getPetalsByConversationId(conversationId: string): PetalRow[] {
  return db.query<PetalRow, [string]>(
    "SELECT * FROM petals WHERE conversation_id = ?"
  ).all(conversationId) as PetalRow[];
}

export function petalExists(messageId: string, word: string): boolean {
  const result = db.query<{ count: number }, [string, string]>(
    "SELECT COUNT(*) as count FROM petals WHERE message_id = ? AND word = ?"
  ).get(messageId, word);
  return (result?.count ?? 0) > 0;
}

export function deletePetalByMessageAndWord(messageId: string, word: string): boolean {
  const petal = db.query<{ id: string }, [string, string]>(
    "SELECT id FROM petals WHERE message_id = ? AND word = ? LIMIT 1"
  ).get(messageId, word);

  if (petal) {
    db.run("DELETE FROM petals WHERE id = ?", [petal.id]);
    return true;
  }
  return false;
}
