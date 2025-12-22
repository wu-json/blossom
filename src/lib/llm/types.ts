export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64, may include data URI prefix (e.g., "data:image/png;base64,...")
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
