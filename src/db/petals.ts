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
  created_at: number;
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
  userInput: string
): PetalRow {
  const id = generateId();
  const createdAt = Date.now();

  db.run(
    `INSERT INTO petals (id, word, reading, meaning, part_of_speech, language, conversation_id, message_id, user_input, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, word, reading, meaning, partOfSpeech, language, conversationId, messageId, userInput, createdAt]
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
    created_at: createdAt,
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
