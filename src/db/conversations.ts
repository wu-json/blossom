import { db } from "./database";

export interface ConversationRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function createConversation(title: string = "New Conversation"): ConversationRow {
  const id = generateId();
  const now = Date.now();

  db.run(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [id, title, now, now]
  );

  return { id, title, created_at: now, updated_at: now };
}

export function getConversations(limit: number = 10): ConversationRow[] {
  return db.query<ConversationRow, []>(
    "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?"
  ).all(limit) as ConversationRow[];
}

export function getConversationById(id: string): ConversationRow | null {
  return db.query<ConversationRow, [string]>(
    "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?"
  ).get(id) as ConversationRow | null;
}

export function updateConversationTitle(id: string, title: string): void {
  db.run(
    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
    [title, Date.now(), id]
  );
}

export function updateConversationTimestamp(id: string): void {
  db.run(
    "UPDATE conversations SET updated_at = ? WHERE id = ?",
    [Date.now(), id]
  );
}

export function deleteConversation(id: string): void {
  db.run("DELETE FROM messages WHERE conversation_id = ?", [id]);
  db.run("DELETE FROM conversations WHERE id = ?", [id]);
}
