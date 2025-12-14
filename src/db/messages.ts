import { db } from "./database";

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: number;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function createMessage(
  conversationId: string,
  role: string,
  content: string
): MessageRow {
  const id = generateId();
  const timestamp = Date.now();

  db.run(
    "INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)",
    [id, conversationId, role, content, timestamp]
  );

  return { id, conversation_id: conversationId, role, content, timestamp };
}

export function getMessagesByConversationId(conversationId: string): MessageRow[] {
  return db.query<MessageRow, [string]>(
    "SELECT id, conversation_id, role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC"
  ).all(conversationId) as MessageRow[];
}

export function updateMessageContent(id: string, content: string): void {
  db.run(
    "UPDATE messages SET content = ? WHERE id = ?",
    [content, id]
  );
}
