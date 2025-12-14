import { Database } from "bun:sqlite";

const db = new Database("blossom.db");

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON");

// Create tables if they don't exist
db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  )
`);

// Create index for faster lookups
db.run(`
  CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id)
`);

export { db };
