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

    const firstBlock = response.content[0];
    if (firstBlock && firstBlock.type === "text") {
      return firstBlock.text;
    }
    return "";
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private convertMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.images?.length
        ? [
            ...m.images.map((img) => {
              const { mediaType, data } = this.parseImage(img);
              return {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: mediaType,
                  data,
                },
              };
            }),
            { type: "text" as const, text: m.content },
          ]
        : m.content,
    }));
  }

  private parseImage(img: string): { mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string } {
    const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match && match[1] && match[2]) {
      return {
        mediaType: match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: match[2],
      };
    }
    // Assume raw base64 PNG if no prefix
    return { mediaType: "image/png", data: img };
  }
}
