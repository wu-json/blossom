import type { LLMProvider, LLMStreamOptions, LLMMessage } from "./types";

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

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
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 minute timeout for model loading
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Ollama error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
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
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 minute timeout for model loading
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Ollama error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`);
    }

    const json = await response.json();
    return json.message?.content || "";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
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
