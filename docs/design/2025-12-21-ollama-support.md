# Ollama Support

**Date:** 2025-12-21
**Status:** Draft

## Overview

Add support for Ollama as an alternative LLM provider, enabling users without Anthropic API keys to run models locally for translation. The primary target model is `gemma3:12b`, which provides good multilingual capabilities for Japanese, Chinese, and Korean translation.

## Motivation

- Not all users have access to Anthropic API keys
- Some users prefer running models locally for privacy or cost reasons
- Local models can work offline once downloaded
- Gemma 3 12B has strong multilingual performance suitable for language learning

## User Flow

1. User navigates to Settings
2. User selects "LLM Provider": Anthropic (default) or Ollama
3. If Ollama selected:
   - User enters Ollama server URL (default: `http://localhost:11434`)
   - User selects model from dropdown (populated from Ollama API)
   - System validates connection and model availability
4. All translation features (chat, YouTube) use the configured provider

## Technical Design

### Provider Abstraction

Create a unified LLM interface that both Anthropic and Ollama can implement:

```typescript
// src/lib/llm/types.ts

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64 encoded
}

export interface LLMStreamOptions {
  model: string;
  messages: LLMMessage[];
  system: string;
  maxTokens: number;
}

export interface LLMProvider {
  name: string;

  // Streaming response for chat/translation
  stream(options: LLMStreamOptions): AsyncIterable<string>;

  // Non-streaming for simple tasks (title generation)
  complete(options: LLMStreamOptions): Promise<string>;

  // Check if provider is configured and available
  isAvailable(): Promise<boolean>;

  // List available models (for Ollama model selection)
  listModels?(): Promise<string[]>;
}
```

### Provider Implementations

#### Anthropic Provider

```typescript
// src/lib/llm/anthropic.ts

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMStreamOptions, LLMMessage } from "./types";

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *stream(options: LLMStreamOptions): AsyncIterable<string> {
    const messages = this.convertMessages(options.messages);

    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens,
      system: [{ type: "text", text: options.system, cache_control: { type: "ephemeral" } }],
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }

  async complete(options: LLMStreamOptions): Promise<string> {
    const messages = this.convertMessages(options.messages);

    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      messages,
    });

    return response.content[0].type === "text" ? response.content[0].text : "";
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple validation - could ping API
      return true;
    } catch {
      return false;
    }
  }

  private convertMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.images?.length
        ? [
            ...m.images.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: "image/png" as const,
                data: img,
              },
            })),
            { type: "text" as const, text: m.content },
          ]
        : m.content,
    }));
  }
}
```

#### Ollama Provider

```typescript
// src/lib/llm/ollama.ts

import type { LLMProvider, LLMStreamOptions, LLMMessage } from "./types";

export class OllamaProvider implements LLMProvider {
  name = "ollama";
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:11434") {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  async *stream(options: LLMStreamOptions): AsyncIterable<string> {
    const messages = this.convertMessages(options.messages, options.system);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  async complete(options: LLMStreamOptions): Promise<string> {
    const messages = this.convertMessages(options.messages, options.system);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.message?.content || "";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const json = await response.json();
      return json.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  private convertMessages(messages: LLMMessage[], system: string): OllamaMessage[] {
    const result: OllamaMessage[] = [];

    // Add system message first
    if (system) {
      result.push({ role: "system", content: system });
    }

    // Convert messages, handling images
    for (const m of messages) {
      if (m.images?.length) {
        // Ollama expects raw base64 WITHOUT the data URI prefix
        // Strip "data:image/png;base64," or similar prefixes
        const cleanedImages = m.images.map((img) =>
          img.replace(/^data:image\/\w+;base64,/, "")
        );
        result.push({
          role: m.role,
          content: m.content,
          images: cleanedImages,
        });
      } else {
        result.push({ role: m.role, content: m.content });
      }
    }

    return result;
  }
}

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}
```

### Provider Factory

```typescript
// src/lib/llm/index.ts

import { AnthropicProvider } from "./anthropic";
import { OllamaProvider } from "./ollama";
import type { LLMProvider } from "./types";

export type ProviderConfig =
  | { type: "anthropic"; apiKey: string }
  | { type: "ollama"; baseUrl: string };

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "anthropic":
      return new AnthropicProvider(config.apiKey);
    case "ollama":
      return new OllamaProvider(config.baseUrl);
    default:
      throw new Error(`Unknown provider type: ${(config as any).type}`);
  }
}

export { type LLMProvider, type LLMMessage, type LLMStreamOptions } from "./types";
```

### Settings Storage

Extend the database to store provider configuration:

```sql
-- Add to schema in src/db/database.ts

CREATE TABLE IF NOT EXISTS llm_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
  provider TEXT NOT NULL DEFAULT 'anthropic',  -- 'anthropic' | 'ollama'
  chat_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  title_model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  ollama_url TEXT DEFAULT 'http://localhost:11434',
  updated_at INTEGER NOT NULL
);
```

```typescript
// src/db/llm-settings.ts

import { db } from "./database";

export interface LLMSettings {
  provider: "anthropic" | "ollama";
  chatModel: string;    // Used for chat & translation
  titleModel: string;   // Used for title generation
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
  const row = db.query("SELECT * FROM llm_settings WHERE id = 1").get() as any;

  if (!row) {
    return {
      provider: "anthropic",
      chatModel: ANTHROPIC_DEFAULTS.chatModel,
      titleModel: ANTHROPIC_DEFAULTS.titleModel,
      ollamaUrl: "http://localhost:11434",
    };
  }

  return {
    provider: row.provider,
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

// Helper to get defaults when switching providers
export function getDefaultModels(provider: "anthropic" | "ollama") {
  return provider === "anthropic" ? ANTHROPIC_DEFAULTS : OLLAMA_DEFAULTS;
}
```

### API Routes

Add endpoints for LLM settings and Ollama management:

```typescript
// In src/index.ts

"/api/llm/settings": {
  GET: () => {
    const settings = getLLMSettings();
    return Response.json(settings);
  },
  PUT: async (req) => {
    const body = await req.json();
    updateLLMSettings(body);
    return Response.json({ success: true });
  },
},

"/api/llm/ollama/status": {
  POST: async (req) => {
    const { url } = await req.json();
    try {
      const provider = new OllamaProvider(url);
      const available = await provider.isAvailable();
      const models = available ? await provider.listModels() : [];
      return Response.json({ available, models });
    } catch (error) {
      return Response.json({ available: false, models: [], error: String(error) });
    }
  },
},
```

### Provider Helper

Create a helper to reduce boilerplate when creating providers:

```typescript
// src/lib/llm/get-provider.ts

import { getLLMSettings } from "@/db/llm-settings";
import { AnthropicProvider } from "./anthropic";
import { OllamaProvider } from "./ollama";
import type { LLMProvider } from "./types";

export function getProvider(): LLMProvider | { error: string } {
  const settings = getLLMSettings();

  if (settings.provider === "ollama") {
    return new OllamaProvider(settings.ollamaUrl);
  }

  const apiKey = Bun.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { error: "Anthropic API key not configured" };
  }
  return new AnthropicProvider(apiKey);
}
```

### Refactoring Chat Endpoint

Update `/api/chat` to use the provider abstraction:

```typescript
"/api/chat": {
  POST: async (req) => {
    const llmSettings = getLLMSettings();

    // Create provider based on settings
    let provider: LLMProvider;
    if (llmSettings.provider === "ollama") {
      provider = new OllamaProvider(llmSettings.ollamaUrl);
    } else {
      const apiKey = Bun.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "Anthropic API key not configured" }, { status: 400 });
      }
      provider = new AnthropicProvider(apiKey);
    }

    // Build messages from request...
    const { messages, system } = buildChatContext(req);

    // Stream response using chatModel
    const stream = provider.stream({
      model: llmSettings.chatModel,
      messages,
      system,
      maxTokens: 4096,
    });

    // Convert to SSE response
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of stream) {
            controller.enqueue(`data: ${JSON.stringify({ text })}\n\n`);
          }
          controller.enqueue("data: [DONE]\n\n");
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
},
```

### Refactoring Title Generation Endpoint

Update `/api/conversations/:id/title` to use the provider abstraction:

```typescript
"/api/conversations/:id/title": {
  POST: async (req, params) => {
    const llmSettings = getLLMSettings();

    // Create provider based on settings
    let provider: LLMProvider;
    if (llmSettings.provider === "ollama") {
      provider = new OllamaProvider(llmSettings.ollamaUrl);
    } else {
      const apiKey = Bun.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "Anthropic API key not configured" }, { status: 400 });
      }
      provider = new AnthropicProvider(apiKey);
    }

    // Build title generation prompt from conversation...
    const messages = buildTitlePrompt(params.id);

    // Use titleModel for fast/cheap title generation
    const title = await provider.complete({
      model: llmSettings.titleModel,
      messages,
      system: "",
      maxTokens: 50,
    });

    // Update conversation title in database
    updateConversationTitle(params.id, title.trim());

    return Response.json({ title: title.trim() });
  },
},
```

### Refactoring YouTube Translation Endpoint

Update `/api/youtube/translate` similarly - uses `chatModel` since translation is the primary task.

### Settings UI

Add provider configuration to the Settings page:

```typescript
// In src/features/settings/settings-page.tsx

const ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-haiku-4-5-20251001",
];

const DEFAULT_MODELS = {
  anthropic: {
    chatModel: "claude-sonnet-4-20250514",
    titleModel: "claude-haiku-4-5-20251001",
  },
  ollama: {
    chatModel: "gemma3:12b",
    titleModel: "gemma3:12b",
  },
};

function LLMProviderSettings() {
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[] } | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);

  // Check Ollama status
  const checkOllamaStatus = async (url: string) => {
    setIsCheckingOllama(true);
    try {
      const response = await fetch("/api/llm/ollama/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const status = await response.json();
      setOllamaStatus(status);
    } finally {
      setIsCheckingOllama(false);
    }
  };

  // Fetch current settings on mount
  useEffect(() => {
    fetch("/api/llm/settings")
      .then((r) => r.json())
      .then((s) => {
        setSettings(s);
        // Check Ollama health if it's the current provider
        if (s.provider === "ollama") {
          checkOllamaStatus(s.ollamaUrl);
        }
      });
  }, []);

  // Handle provider change - reset models to defaults for the new provider
  const handleProviderChange = (provider: "anthropic" | "ollama") => {
    const defaults = DEFAULT_MODELS[provider];
    updateSettings({
      provider,
      chatModel: defaults.chatModel,
      titleModel: defaults.titleModel,
    });
    // Immediately check Ollama health when switching to it
    if (provider === "ollama" && settings) {
      checkOllamaStatus(settings.ollamaUrl);
    }
  };

  return (
    <div className="space-y-4">
      <h3>LLM Provider</h3>

      <RadioGroup
        value={settings?.provider}
        onChange={handleProviderChange}
      >
        <RadioOption value="anthropic">
          Anthropic (Claude)
          <span className="text-muted">Requires API key</span>
        </RadioOption>
        <RadioOption value="ollama">
          Ollama (Local)
          <span className="text-muted">Run models on your machine</span>
        </RadioOption>
      </RadioGroup>

      {settings?.provider === "anthropic" && (
        <div className="space-y-3">
          <Select
            label="Chat & Translation Model"
            value={settings.chatModel}
            onChange={(model) => updateSettings({ chatModel: model })}
            options={ANTHROPIC_MODELS.map((m) => ({ value: m, label: m }))}
          />
          <Select
            label="Title Generation Model"
            value={settings.titleModel}
            onChange={(model) => updateSettings({ titleModel: model })}
            options={ANTHROPIC_MODELS.map((m) => ({ value: m, label: m }))}
          />
        </div>
      )}

      {settings?.provider === "ollama" && (
        <div className="space-y-3">
          <Input
            label="Ollama Server URL"
            value={settings.ollamaUrl}
            onChange={(e) => {
              updateSettings({ ollamaUrl: e.target.value });
              checkOllamaStatus(e.target.value);
            }}
            placeholder="http://localhost:11434"
          />

          {isCheckingOllama ? (
            <div className="text-muted">Checking Ollama connection...</div>
          ) : ollamaStatus?.available ? (
            <>
              <div className="text-success flex items-center gap-2">
                <CheckCircle size={16} />
                Connected to Ollama
              </div>
              {ollamaStatus.models.length > 0 ? (
                <>
                  <Select
                    label="Chat & Translation Model"
                    value={settings.chatModel}
                    onChange={(model) => updateSettings({ chatModel: model })}
                    options={ollamaStatus.models.map((m) => ({ value: m, label: m }))}
                  />
                  <Select
                    label="Title Generation Model"
                    value={settings.titleModel}
                    onChange={(model) => updateSettings({ titleModel: model })}
                    options={ollamaStatus.models.map((m) => ({ value: m, label: m }))}
                  />
                </>
              ) : (
                <div className="text-warning">
                  No models found. Run: ollama pull gemma3:12b
                </div>
              )}
            </>
          ) : (
            <div className="text-error flex items-center gap-2">
              <XCircle size={16} />
              Cannot connect to Ollama. Make sure it's running.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Status API Update

Update `/api/status` to reflect LLM configuration:

```typescript
"/api/status": {
  GET: async () => {
    const apiKey = Bun.env.ANTHROPIC_API_KEY;
    const llmSettings = getLLMSettings();

    let ollamaAvailable = false;
    if (llmSettings.provider === "ollama") {
      const provider = new OllamaProvider(llmSettings.ollamaUrl);
      ollamaAvailable = await provider.isAvailable();
    }

    return Response.json({
      llmProvider: llmSettings.provider,
      anthropicConfigured: !!apiKey,
      anthropicKeyPreview: apiKey ? `...${apiKey.slice(-6)}` : null,
      ollamaUrl: llmSettings.ollamaUrl,
      ollamaModel: llmSettings.ollamaModel,
      ollamaAvailable,
      dataDir: blossomDir,
    });
  },
},
```

### Model Considerations

#### Gemma 3 12B Capabilities

- Strong multilingual support for Japanese, Chinese, Korean
- Vision capabilities for image-based translation (YouTube frames)
- 128K context window
- Runs on consumer hardware (16GB+ RAM recommended)

#### Model Recommendations

| Use Case | Recommended Model | Notes |
|----------|-------------------|-------|
| General use | `gemma3:12b` | Good balance of quality and speed |
| Lower memory | `gemma3:4b` | Faster, less accurate |
| Higher quality | `gemma3:27b` | Requires 32GB+ RAM |

#### Vision Support

Gemma 3 supports vision, so image-based translation (YouTube frames) works. The Ollama API accepts images in the message format:

```typescript
{
  role: "user",
  content: "Translate the text in this image",
  images: ["base64encodedimage..."]
}
```

### Error Handling

Handle provider-specific errors gracefully:

```typescript
// In chat endpoint
try {
  for await (const text of provider.stream(options)) {
    // ... handle streaming text
  }
} catch (error) {
  if (llmSettings.provider === "ollama") {
    if (error.message.includes("ECONNREFUSED")) {
      return Response.json({
        error: "Cannot connect to Ollama. Make sure Ollama is running."
      }, { status: 503 });
    }
    if (error.message.includes("model") && error.message.includes("not found")) {
      return Response.json({
        error: `Model "${llmSettings.chatModel}" not found. Run: ollama pull ${llmSettings.chatModel}`
      }, { status: 400 });
    }
  }
  throw error;
}
```

#### Model Deletion Handling

If a user deletes a model from Ollama after selecting it in settings:
- **Don't validate on every request** - adds latency and complexity
- **Let it fail at request time** - show clear error message with `ollama pull` command
- **Settings UI re-validates on load** - when user opens settings, check Ollama status and show warning if selected model is missing

```typescript
// In Settings UI, after fetching Ollama models
useEffect(() => {
  if (ollamaStatus?.available && settings?.provider === "ollama") {
    const chatModelExists = ollamaStatus.models.includes(settings.chatModel);
    const titleModelExists = ollamaStatus.models.includes(settings.titleModel);

    if (!chatModelExists || !titleModelExists) {
      setModelWarning("One or more selected models are no longer available in Ollama.");
    }
  }
}, [ollamaStatus, settings]);
```

### Translations

Add UI strings:

```typescript
// src/lib/translations.ts

llmProvider: {
  en: "LLM Provider",
  ja: "LLMプロバイダー",
  zh: "LLM提供商",
  ko: "LLM 제공자",
},
ollama: {
  en: "Ollama (Local)",
  ja: "Ollama（ローカル）",
  zh: "Ollama（本地）",
  ko: "Ollama (로컬)",
},
ollamaUrl: {
  en: "Ollama Server URL",
  ja: "Ollamaサーバー URL",
  zh: "Ollama服务器 URL",
  ko: "Ollama 서버 URL",
},
ollamaNotRunning: {
  en: "Cannot connect to Ollama. Make sure it's running.",
  ja: "Ollamaに接続できません。起動していることを確認してください。",
  zh: "无法连接到Ollama。请确保其正在运行。",
  ko: "Ollama에 연결할 수 없습니다. 실행 중인지 확인하세요.",
},
```

## File Structure

```
src/lib/llm/
├── types.ts          # LLMProvider interface, shared types
├── anthropic.ts      # Anthropic implementation
├── ollama.ts         # Ollama implementation
├── get-provider.ts   # Helper to get configured provider
└── index.ts          # Factory and exports

src/db/
└── llm-settings.ts   # LLM settings CRUD
```

## Implementation Phases

### Phase 1: Core Abstraction
- Create `src/lib/llm/` with provider interface
- Implement AnthropicProvider (refactor existing code)
- Implement OllamaProvider
- Add LLM settings database table and CRUD

### Phase 2: API Integration
- Add `/api/llm/settings` endpoints
- Add `/api/llm/ollama/status` endpoint
- Refactor `/api/chat` to use provider abstraction
- Refactor `/api/youtube/translate` to use provider abstraction

### Phase 3: Settings UI
- Add LLM Provider section to Settings page
- Implement Ollama connection testing
- Implement model selection dropdown

### Phase 4: Polish
- Add helpful error messages for common Ollama issues
- Add model recommendations to UI
- Update status API and any status displays

## Testing

1. **Anthropic path**: Verify existing functionality still works
2. **Ollama connection**: Test with Ollama running/not running
3. **Model switching**: Change models mid-session
4. **Image support**: Verify YouTube frame translation works with Gemma 3
5. **Error handling**: Test various failure modes (connection refused, model not found, etc.)

## Abstraction Trade-offs

Features preserved in the abstraction:

1. **Prompt caching** - Baked into `AnthropicProvider` implementation, transparent to callers. Ollama doesn't support this, so no loss there.

2. **Image/vision support** - Both providers handle images, just with different message formats internally.

3. **Streaming** - Both providers expose async iterables, hiding protocol differences.

4. **Model-per-task configuration** - Both providers support separate models for chat/translation vs title generation. Users can configure this in Settings.

Features lost or simplified:

1. **Token usage reporting** - Anthropic returns token counts; Ollama doesn't consistently. Not currently shown in UI anyway.

2. **Specific error types** - `Anthropic.APIError` provides structured errors (413, 429, etc.). Generic error handling is sufficient for our needs.

3. **Tool use / function calling** - Not currently used. Would require provider-specific implementations if added later.

## Security Considerations

1. **Local-only Ollama**: Default URL is localhost; warn users about exposing Ollama to network
2. **No API key storage**: Ollama doesn't require API keys, but still validate URLs
3. **Input validation**: Sanitize Ollama URL before use

## Future Enhancements

1. **Download management**: Help users download recommended models through the UI
2. **OpenAI-compatible API**: Support other local inference servers (llama.cpp server, text-generation-webui, etc.)
