import { db } from "./database";

export interface LLMSettings {
  provider: "anthropic" | "ollama";
  chatModel: string;
  titleModel: string;
  ollamaUrl: string;
}

const ANTHROPIC_DEFAULTS = {
  chatModel: "claude-sonnet-4-20250514",
  titleModel: "claude-haiku-4-5-20251001",
};

const OLLAMA_DEFAULTS = {
  chatModel: "gemma3:12b",
  titleModel: "gemma3:12b",
};

export function getLLMSettings(): LLMSettings {
  const row = db.query("SELECT * FROM llm_settings WHERE id = 1").get() as {
    provider: string;
    chat_model: string;
    title_model: string;
    ollama_url: string;
  } | null;

  if (!row) {
    return {
      provider: "anthropic",
      chatModel: ANTHROPIC_DEFAULTS.chatModel,
      titleModel: ANTHROPIC_DEFAULTS.titleModel,
      ollamaUrl: "http://localhost:11434",
    };
  }

  return {
    provider: row.provider as "anthropic" | "ollama",
    chatModel: row.chat_model,
    titleModel: row.title_model,
    ollamaUrl: row.ollama_url,
  };
}

export function updateLLMSettings(settings: Partial<LLMSettings>): void {
  const current = getLLMSettings();
  const merged = { ...current, ...settings };

  db.run(
    `INSERT INTO llm_settings (id, provider, chat_model, title_model, ollama_url, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       provider = excluded.provider,
       chat_model = excluded.chat_model,
       title_model = excluded.title_model,
       ollama_url = excluded.ollama_url,
       updated_at = excluded.updated_at`,
    [merged.provider, merged.chatModel, merged.titleModel, merged.ollamaUrl, Date.now()]
  );
}

export function getDefaultModels(provider: "anthropic" | "ollama") {
  return provider === "anthropic" ? ANTHROPIC_DEFAULTS : OLLAMA_DEFAULTS;
}
