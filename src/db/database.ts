import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Create ~/.blossom directory if it doesn't exist
const blossomDir = join(homedir(), ".blossom");
mkdirSync(blossomDir, { recursive: true });

const dbPath = join(blossomDir, "sqlite.db");
const db = new Database(dbPath);

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

// Create teacher settings table (singleton pattern - only one row)
db.run(`
  CREATE TABLE IF NOT EXISTS teacher_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT 'Blossom',
    profile_image_path TEXT,
    personality TEXT,
    updated_at INTEGER NOT NULL
  )
`);

// Migration: Add personality column if it doesn't exist (for existing databases)
try {
  db.run(`ALTER TABLE teacher_settings ADD COLUMN personality TEXT`);
} catch {
  // Column already exists, ignore
}

// Migration: Add images column to messages table (for existing databases)
try {
  db.run(`ALTER TABLE messages ADD COLUMN images TEXT DEFAULT NULL`);
} catch {
  // Column already exists, ignore
}

export { db, blossomDir };
