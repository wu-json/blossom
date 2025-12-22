import { getLLMSettings } from "../../db/llm-settings";
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
