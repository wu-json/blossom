// Request size constants
const MAX_REQUEST_SIZE = 32 * 1024 * 1024; // 32 MB
const SAFETY_MARGIN = 2 * 1024 * 1024; // 2 MB buffer for JSON overhead
const EFFECTIVE_MAX_SIZE = MAX_REQUEST_SIZE - SAFETY_MARGIN;

// Compaction configuration
const IMAGES_TO_KEEP = 4; // Keep images in last N messages
const MIN_MESSAGES_TO_KEEP = 10;
const EMERGENCY_MIN_MESSAGES = 5;

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

interface ImageBlock {
  type: "image";
  source: { type: "base64"; media_type: ImageMediaType; data: string };
}

interface TextBlock {
  type: "text";
  text: string;
}

type ContentBlock = ImageBlock | TextBlock;

export interface TransformedMessage {
  role: string;
  content: string | ContentBlock[];
}

export interface CompactionResult {
  messages: TransformedMessage[];
  wasCompacted: boolean;
  droppedImageCount: number;
  droppedMessageCount: number;
}

function estimateMessageSize(message: TransformedMessage): number {
  if (typeof message.content === "string") {
    // Text-only message: estimate JSON overhead + content
    return message.content.length + 50;
  }

  // Multi-part content with images
  let size = 100; // Base JSON overhead
  for (const block of message.content) {
    if (block.type === "image") {
      size += block.source.data.length + 150;
    } else {
      size += block.text.length + 50;
    }
  }
  return size;
}

function estimateTotalSize(
  systemPrompt: string,
  messages: TransformedMessage[]
): number {
  let total = systemPrompt.length + 500; // System prompt + request wrapper
  for (const msg of messages) {
    total += estimateMessageSize(msg);
  }
  return total;
}

/**
 * Compacts messages to fit within API request size limits.
 * This is a pure transformation - it does not modify the original messages array.
 * The original conversation history in the database remains unchanged.
 */
export function compactMessages(
  systemPrompt: string,
  messages: TransformedMessage[]
): CompactionResult {
  // Create a deep copy to avoid mutating the original
  let workingMessages: TransformedMessage[] = messages.map((msg) => {
    if (typeof msg.content === "string") {
      return { ...msg };
    }
    return {
      ...msg,
      content: msg.content.map((block) => ({ ...block })),
    };
  });

  let currentSize = estimateTotalSize(systemPrompt, workingMessages);
  let wasCompacted = false;
  let droppedImageCount = 0;
  let droppedMessageCount = 0;

  // Phase 1: Drop images from older messages (keep images in last N messages)
  if (currentSize > EFFECTIVE_MAX_SIZE) {
    const imageDropThreshold = workingMessages.length - IMAGES_TO_KEEP;

    for (let i = 0; i < imageDropThreshold && i < workingMessages.length; i++) {
      const msg = workingMessages[i];
      if (Array.isArray(msg.content)) {
        const imageBlocks = msg.content.filter(
          (b): b is ImageBlock => b.type === "image"
        );
        if (imageBlocks.length > 0) {
          // Extract text content
          const textParts = msg.content
            .filter((b): b is TextBlock => b.type === "text")
            .map((b) => b.text);

          const imageCount = imageBlocks.length;
          droppedImageCount += imageCount;

          // Replace with text-only message including placeholder
          const placeholder = `[${imageCount} image(s) removed for context management]`;
          workingMessages[i] = {
            role: msg.role,
            content:
              textParts.length > 0
                ? `${placeholder}\n\n${textParts.join("\n")}`
                : placeholder,
          };
          wasCompacted = true;
        }
      }
    }

    currentSize = estimateTotalSize(systemPrompt, workingMessages);
  }

  // Phase 2: Truncate oldest messages (keep minimum MIN_MESSAGES_TO_KEEP)
  if (
    currentSize > EFFECTIVE_MAX_SIZE &&
    workingMessages.length > MIN_MESSAGES_TO_KEEP
  ) {
    while (
      currentSize > EFFECTIVE_MAX_SIZE &&
      workingMessages.length > MIN_MESSAGES_TO_KEEP
    ) {
      workingMessages.shift();
      droppedMessageCount++;
      currentSize = estimateTotalSize(systemPrompt, workingMessages);
    }
    wasCompacted = true;
  }

  // Phase 3: Emergency truncation (keep minimum EMERGENCY_MIN_MESSAGES)
  if (
    currentSize > EFFECTIVE_MAX_SIZE &&
    workingMessages.length > EMERGENCY_MIN_MESSAGES
  ) {
    while (
      currentSize > EFFECTIVE_MAX_SIZE &&
      workingMessages.length > EMERGENCY_MIN_MESSAGES
    ) {
      workingMessages.shift();
      droppedMessageCount++;
      currentSize = estimateTotalSize(systemPrompt, workingMessages);
    }
    wasCompacted = true;
  }

  return {
    messages: workingMessages,
    wasCompacted,
    droppedImageCount,
    droppedMessageCount,
  };
}
