import { db } from "./database";

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: number;
  images: string | null;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function createMessage(
  conversationId: string,
  role: string,
  content: string,
  images?: string[]
): MessageRow {
  const id = generateId();
  const timestamp = Date.now();
  const imagesJson = images && images.length > 0 ? JSON.stringify(images) : null;

  db.run(
    "INSERT INTO messages (id, conversation_id, role, content, timestamp, images) VALUES (?, ?, ?, ?, ?, ?)",
    [id, conversationId, role, content, timestamp, imagesJson]
  );

  return { id, conversation_id: conversationId, role, content, timestamp, images: imagesJson };
}

export function getMessagesByConversationId(conversationId: string): MessageRow[] {
  return db.query<MessageRow, [string]>(
    "SELECT id, conversation_id, role, content, timestamp, images FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC"
  ).all(conversationId) as MessageRow[];
}

export function updateMessageContent(id: string, content: string): void {
  db.run(
    "UPDATE messages SET content = ? WHERE id = ?",
    [content, id]
  );
}

export function getMessageById(conversationId: string, messageId: string): MessageRow | null {
  return db.query<MessageRow, [string, string]>(
    "SELECT id, conversation_id, role, content, timestamp, images FROM messages WHERE conversation_id = ? AND id = ?"
  ).get(conversationId, messageId) as MessageRow | null;
}
