import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

// Get directory from BLOSSOM_DIR env var, default to ~/.blossom
const envDataDir = Bun.env.BLOSSOM_DIR;
const blossomDir = envDataDir
  ? (isAbsolute(envDataDir) ? envDataDir : resolve(envDataDir))
  : join(homedir(), ".blossom");
mkdirSync(blossomDir, { recursive: true });

const dbPath = join(blossomDir, "sqlite.db");
const db = new Database(dbPath);

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON");

// Conversations
db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

// Messages
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`);

// Teacher settings (singleton)
db.run(`
  CREATE TABLE IF NOT EXISTS teacher_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT 'Blossom',
    profile_image_path TEXT,
    personality TEXT,
    updated_at INTEGER NOT NULL
  )
`);

// Petals (vocabulary)
db.run(`
  CREATE TABLE IF NOT EXISTS petals (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    reading TEXT NOT NULL,
    meaning TEXT NOT NULL,
    part_of_speech TEXT NOT NULL,
    language TEXT NOT NULL,
    conversation_id TEXT,
    message_id TEXT NOT NULL,
    user_input TEXT NOT NULL,
    user_images TEXT,
    created_at INTEGER NOT NULL,
    source_type TEXT DEFAULT 'chat',
    youtube_translation_id TEXT
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_petals_language ON petals(language)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_petals_word ON petals(word)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_petals_word_language ON petals(word, language)`);

// YouTube translations
db.run(`
  CREATE TABLE IF NOT EXISTS youtube_translations (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    video_title TEXT,
    timestamp_seconds REAL NOT NULL,
    frame_image TEXT,
    translation_data TEXT,
    created_at INTEGER NOT NULL
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_youtube_translations_video_id ON youtube_translations(video_id)`);

export { db, blossomDir };
