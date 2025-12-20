# Blossom

AI-powered conversational language learning app for Japanese, Chinese, and Korean. Users practice through natural dialogue with an AI tutor (Claude), with automatic word-by-word translation breakdowns and vocabulary collection.

## Tech Stack

- **Runtime:** Bun (use `bun` instead of `node`, `bun install` instead of `npm`)
- **Backend:** `Bun.serve()` with `bun:sqlite` for SQLite
- **Frontend:** React 19 + Vite + Tailwind CSS
- **State:** Zustand (persisted to localStorage)
- **AI:** Anthropic SDK (Claude claude-sonnet-4-20250514)
- **Routing:** Wouter

## Project Structure

```
src/
├── index.ts              # Bun server entry point, all API routes
├── frontend.tsx          # React app bootstrap
├── router.tsx            # Frontend routing
├── components/           # Reusable UI components
│   ├── layout/           # App shell
│   ├── sidebar/          # Navigation
│   └── ui/               # Primitives (Button, Input, etc.)
├── features/             # Page modules
│   ├── chat/             # Chat interface
│   ├── meadow/           # Vocabulary review (flowers & petals)
│   ├── teacher/          # AI teacher customization
│   └── settings/         # App settings
├── db/                   # SQLite database layer
│   ├── database.ts       # Schema & initialization
│   ├── conversations.ts  # Conversation CRUD
│   ├── messages.ts       # Message CRUD
│   ├── petals.ts         # Vocabulary CRUD
│   └── teacher.ts        # Teacher settings
├── store/                # Zustand state
├── hooks/                # Custom React hooks
├── lib/                  # Utilities
└── types/                # TypeScript types
```

## Development

```bash
bun install              # Install dependencies
curse                    # Start dev (API + Vite) - preferred
bun --hot ./src/index.ts # API server only (port 3000)
bun vite                 # Frontend dev server only
```

## Build & Release

```bash
just build               # Embed assets + build binaries
just typecheck           # Run TypeScript checks
just version 0.0.5       # Update version
```

## Database

SQLite stored in `~/.blossom/`. Tables:
- **conversations** - Chat sessions
- **messages** - Chat messages (with images)
- **teacher_settings** - AI teacher config (singleton)
- **petals** - Saved vocabulary words linked to messages

## Key Patterns

### Translation Response Format
AI responses return structured JSON between markers:
```
<<<TRANSLATION_START>>>
{ "originalText", "subtext", "translation", "breakdown": [...], "grammarNotes" }
<<<TRANSLATION_END>>>
```

### Message Compaction
Large conversations are compacted before API calls (keeps last 10 messages, removes oldest images first) to stay within limits.

### Prompt Caching
Last assistant message and system prompt use `cache_control: { type: "ephemeral" }` for cost reduction.

### Vocabulary (Meadow)
- **Flowers** = unique words grouped by word + language
- **Petals** = individual occurrences with context (reading, meaning, part of speech)

## API Routes

Main endpoints in `src/index.ts`:
- `POST /api/chat` - Stream chat response (SSE)
- `GET/POST/DELETE /api/conversations` - Conversation management
- `GET/PUT /api/teacher` - Teacher settings
- `POST/GET/DELETE /api/petals` - Vocabulary management
- `GET /api/data/export` - Export all data as ZIP

## Environment

- `ANTHROPIC_API_KEY` - Required for AI functionality
- `BLOSSOM_DATA_DIR` - Optional custom data directory (default: `~/.blossom`)

## Conventions

- Use Bun APIs over Node.js equivalents (`Bun.file`, `bun:sqlite`, etc.)
- Don't use express, better-sqlite3, or dotenv
- Frontend uses Vite for dev, but production builds embed assets into binary
- Format with `bunx oxfmt`
