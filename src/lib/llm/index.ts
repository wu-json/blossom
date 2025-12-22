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
      throw new Error(`Unknown provider type: ${(config as { type: string }).type}`);
  }
}

export { AnthropicProvider } from "./anthropic";
export { OllamaProvider } from "./ollama";
export { type LLMProvider, type LLMMessage, type LLMStreamOptions } from "./types";
