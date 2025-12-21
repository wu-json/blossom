import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  createConversation,
  getConversations,
  getConversationById,
  updateConversationTitle,
  updateConversationTimestamp,
  deleteConversation,
} from "./db/conversations";
import { createMessage, getMessagesByConversationId, updateMessageContent, getMessageById } from "./db/messages";
import { parseTranslationContent } from "./lib/parse-translation";
import {
  getTeacherSettings,
  updateTeacherName,
  updateTeacherProfileImage,
  updateTeacherPersonality,
} from "./db/teacher";
import {
  createPetal,
  getPetalById,
  getPetalsByWordAndLanguage,
  getPetalsByConversationId,
  petalExists,
  deletePetal,
  deletePetalByMessageAndWord,
  getFlowersByLanguage,
  createPetalWithSource,
  petalExistsByYouTubeTranslation,
} from "./db/petals";
import {
  createYouTubeTranslation,
  getYouTubeTranslationById,
  updateYouTubeTranslationData,
} from "./db/youtube-translations";
import { db, blossomDir } from "./db/database";
import { compactMessages } from "./lib/message-compaction";
import { getImageForApi, type ImageMediaType } from "./lib/image-compression";
import { mkdir, unlink, rm, rename } from "node:fs/promises";
import archiver from "archiver";
import unzipper from "unzipper";
import { join } from "node:path";
import { assets } from "./generated/embedded-assets";

// Add cache_control to the last assistant message for prompt caching
function addCacheControlToMessages(messages: MessageParam[]): MessageParam[] {
  if (messages.length === 0) return messages;

  // Find the last assistant message
  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant");
  if (lastAssistantIndex === -1) return messages;

  return messages.map((msg, index) => {
    if (index !== lastAssistantIndex) return msg;

    // Convert string content to array if needed
    let content: ContentBlockParam[];
    if (typeof msg.content === "string") {
      content = [{ type: "text", text: msg.content }];
    } else {
      content = [...msg.content] as ContentBlockParam[];
    }

    // Add cache_control to the last block
    const lastBlock = content.at(-1);
    if (lastBlock && (lastBlock.type === "text" || lastBlock.type === "image")) {
      content[content.length - 1] = {
        ...lastBlock,
        cache_control: { type: "ephemeral" },
      } as ContentBlockParam;
    }

    return { ...msg, content };
  });
}

// Ensure uploads directory exists in ~/.blossom/uploads
const uploadsDir = join(blossomDir, "uploads");
await mkdir(uploadsDir, { recursive: true });

const languageNames: Record<string, string> = {
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
};

const server = Bun.serve({
  idleTimeout: 120, // 120 seconds for streaming responses
  routes: {
    "/api/status": {
      GET: () => {
        const apiKey = Bun.env.ANTHROPIC_API_KEY;
        const maskedKey = apiKey ? `...${apiKey.slice(-6)}` : null;
        return Response.json({
          anthropicConfigured: !!apiKey,
          anthropicKeyPreview: maskedKey,
          dataDir: blossomDir,
        });
      },
    },
    "/api/conversations": {
      GET: () => {
        const conversations = getConversations(10);
        return Response.json(conversations);
      },
      POST: async (req) => {
        const { title } = await req.json().catch(() => ({ title: "New Conversation" }));
        const conversation = createConversation(title);
        return Response.json(conversation);
      },
    },
    "/api/conversations/:id": {
      GET: (req) => {
        const id = req.params.id;
        const conversation = getConversationById(id);
        if (!conversation) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        const messages = getMessagesByConversationId(id);
        return Response.json({ conversation, messages });
      },
      DELETE: (req) => {
        const id = req.params.id;
        const conversation = getConversationById(id);
        if (!conversation) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        deleteConversation(id);
        return Response.json({ success: true });
      },
    },
    "/api/conversations/:id/title": {
      POST: async (req) => {
        const apiKey = Bun.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "API key not configured" }, { status: 401 });
        }

        const id = req.params.id;
        const conversation = getConversationById(id);
        if (!conversation) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }

        // Parse language from request body
        let language = "ja";
        try {
          const body = await req.json();
          if (body.language) language = body.language;
        } catch {
          // No body or invalid JSON, use default
        }

        const languageNames: Record<string, string> = {
          ja: "Japanese",
          zh: "Chinese",
          ko: "Korean",
        };
        const languageName = languageNames[language] || "Japanese";

        const messages = getMessagesByConversationId(id);
        if (messages.length === 0) {
          return Response.json({ error: "No messages in conversation" }, { status: 400 });
        }

        // Generate title using Haiku with full conversation context (including images)
        const anthropic = new Anthropic({ apiKey });

        // Filter messages with content or images
        const filteredMessages = messages.filter((m) => {
          const hasContent = m.content && m.content.trim().length > 0;
          const hasImages = m.images && m.images.length > 0;
          return hasContent || hasImages;
        });

        // Transform messages to include images
        const transformedMessages = await Promise.all(
          filteredMessages.map(async (m) => {
            if (!m.images || m.images.length === 0) {
              return { role: m.role as "user" | "assistant", content: m.content || "" };
            }

            const contentBlocks: Array<
              | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
              | { type: "text"; text: string }
            > = [];

            for (const imageUrl of m.images) {
              const filename = imageUrl.replace("/api/uploads/", "");
              const filepath = join(uploadsDir, filename);
              const result = await getImageForApi(filepath, filename);

              if (result) {
                contentBlocks.push({
                  type: "image",
                  source: { type: "base64", media_type: result.mediaType, data: result.base64 },
                });
              }
            }

            if (m.content && m.content.trim()) {
              contentBlocks.push({ type: "text", text: m.content });
            }

            return { role: m.role as "user" | "assistant", content: contentBlocks.length > 0 ? contentBlocks : "" };
          })
        );

        // Filter out messages with empty content
        const validMessages = transformedMessages.filter(m => {
          if (typeof m.content === "string") return m.content.length > 0;
          return Array.isArray(m.content) && m.content.length > 0;
        });

        // Apply compaction
        const { messages: compactedMessages } = compactMessages("", validMessages);

        // Build final messages for title generation
        const titleMessages: Array<{ role: "user" | "assistant"; content: string | Array<{ type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } } | { type: "text"; text: string }> }> = [];

        for (const m of compactedMessages) {
          titleMessages.push({
            role: m.role as "user" | "assistant",
            content: m.content as string | Array<{ type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } } | { type: "text"; text: string }>,
          });
        }

        // Add the title generation instruction as the final user message
        titleMessages.push({
          role: "user",
          content: `Based on this conversation, generate a short, concise title (max 5 words) in ${languageName}. Focus primarily on the most recent messages to capture the current topic. Return ONLY the title, no quotes or punctuation.`,
        });

        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 50,
          messages: titleMessages,
        });

        const title = (response.content[0] as { type: string; text: string }).text.trim();
        updateConversationTitle(id, title);

        return Response.json({ title });
      },
      PUT: async (req) => {
        const id = req.params.id;
        const conversation = getConversationById(id);
        if (!conversation) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }

        const { title } = await req.json();
        if (!title || typeof title !== "string") {
          return Response.json({ error: "Title is required" }, { status: 400 });
        }

        updateConversationTitle(id, title.trim());
        return Response.json({ success: true });
      },
    },
    "/api/conversations/:id/messages": {
      POST: async (req) => {
        const id = req.params.id;
        const conversation = getConversationById(id);
        if (!conversation) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }

        const { role, content, messageId, images } = await req.json();

        // If messageId provided, update existing message; otherwise create new
        if (messageId) {
          updateMessageContent(messageId, content);
          updateConversationTimestamp(id);
          return Response.json({ id: messageId, role, content, images });
        }

        const message = createMessage(id, role, content, images);
        updateConversationTimestamp(id);
        return Response.json(message);
      },
    },
    "/api/teacher": {
      GET: () => {
        const settings = getTeacherSettings();
        return Response.json({
          name: settings.name,
          profileImagePath: settings.profile_image_path,
          personality: settings.personality,
        });
      },
      PUT: async (req) => {
        const { name } = await req.json();
        if (!name || typeof name !== "string") {
          return Response.json({ error: "Name is required" }, { status: 400 });
        }
        updateTeacherName(name.trim());
        return Response.json({ success: true });
      },
    },
    "/api/teacher/personality": {
      PUT: async (req) => {
        const { personality } = await req.json();
        updateTeacherPersonality(personality?.trim() || null);
        return Response.json({ success: true });
      },
    },
    "/api/teacher/image": {
      POST: async (req) => {
        const formData = await req.formData();
        const file = formData.get("image") as File | null;

        if (!file) {
          return Response.json({ error: "No image provided" }, { status: 400 });
        }

        const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
        if (!validTypes.includes(file.type)) {
          return Response.json({ error: "Invalid image type" }, { status: 400 });
        }

        // Delete old image if exists
        const currentSettings = getTeacherSettings();
        if (currentSettings.profile_image_path) {
          try {
            // Extract filename from URL path and build full file path
            const oldFilename = currentSettings.profile_image_path.replace("/api/uploads/", "");
            const oldFilePath = join(uploadsDir, oldFilename);
            await unlink(oldFilePath);
          } catch {
            // Ignore if file doesn't exist
          }
        }

        // Generate unique filename
        const ext = file.name.split(".").pop() || "png";
        const filename = `teacher-profile-${Date.now()}.${ext}`;
        const filepath = join(uploadsDir, filename);
        const urlPath = `/api/uploads/${filename}`;

        // Save file
        await Bun.write(filepath, file);
        updateTeacherProfileImage(urlPath);

        return Response.json({ path: urlPath });
      },
      DELETE: async () => {
        const settings = getTeacherSettings();
        if (settings.profile_image_path) {
          try {
            // Extract filename from URL path and build full file path
            const filename = settings.profile_image_path.replace("/api/uploads/", "");
            const filePath = join(uploadsDir, filename);
            await unlink(filePath);
          } catch {
            // Ignore if file doesn't exist
          }
        }
        updateTeacherProfileImage(null);
        return Response.json({ success: true });
      },
    },
    "/api/chat/images": {
      POST: async (req) => {
        const formData = await req.formData();
        const file = formData.get("image") as File | null;

        if (!file) {
          return Response.json({ error: "No image provided" }, { status: 400 });
        }

        const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
        if (!validTypes.includes(file.type)) {
          return Response.json({ error: "Invalid image type" }, { status: 400 });
        }

        // Limit file size to 20MB (Claude vision API limit)
        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
          return Response.json({ error: "Image too large (max 20MB)" }, { status: 400 });
        }

        // Generate unique filename
        const ext = file.name.split(".").pop() || "png";
        const filename = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const filepath = join(uploadsDir, filename);
        const urlPath = `/api/uploads/${filename}`;

        // Save file
        await Bun.write(filepath, file);

        return Response.json({ url: urlPath, filename });
      },
    },
    "/api/uploads/:filename": {
      GET: async (req) => {
        const filename = req.params.filename;
        // Prevent path traversal
        if (filename.includes("..") || filename.includes("/")) {
          return new Response("Not found", { status: 404 });
        }
        const filePath = join(uploadsDir, filename);
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file);
        }
        return new Response("Not found", { status: 404 });
      },
    },
    "/api/data": {
      DELETE: async () => {
        db.close();
        await rm(blossomDir, { recursive: true, force: true });
        return Response.json({ success: true });
      },
    },
    "/api/data/export": {
      GET: async () => {
        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        archive.on("data", (chunk: Buffer) => chunks.push(chunk));

        // Add the entire ~/.blossom directory to the archive
        archive.directory(blossomDir, "blossom");
        await archive.finalize();

        const blob = new Blob([Buffer.concat(chunks)], { type: "application/zip" });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        return new Response(blob, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="blossom-backup-${timestamp}.zip"`,
          },
        });
      },
    },
    "/api/data/import": {
      POST: async (req) => {
        const formData = await req.formData();
        const file = formData.get("backup") as File | null;

        if (!file) {
          return Response.json({ error: "No backup file provided" }, { status: 400 });
        }

        const backupDir = `${blossomDir}.backup`;

        try {
          // Close database before modifying files
          db.close();

          // Backup existing directory
          try {
            await rename(blossomDir, backupDir);
          } catch {
            // Directory might not exist, that's fine
          }

          // Create fresh blossom directory
          await mkdir(blossomDir, { recursive: true });

          // Extract zip contents
          const buffer = Buffer.from(await file.arrayBuffer());
          const directory = await unzipper.Open.buffer(buffer);

          for (const entry of directory.files) {
            if (entry.type === "Directory") continue;

            // Remove "blossom/" prefix from path
            const relativePath = entry.path.replace(/^blossom\//, "");
            if (!relativePath) continue;

            const targetPath = join(blossomDir, relativePath);
            const targetDir = join(targetPath, "..");
            await mkdir(targetDir, { recursive: true });

            const content = await entry.buffer();
            await Bun.write(targetPath, content);
          }

          // Remove backup on success
          try {
            await rm(backupDir, { recursive: true, force: true });
          } catch {
            // Ignore cleanup errors
          }

          return Response.json({ success: true });
        } catch (error) {
          // Restore backup on failure
          try {
            await rm(blossomDir, { recursive: true, force: true });
            await rename(backupDir, blossomDir);
          } catch {
            // Best effort restore
          }
          return Response.json({ error: "Failed to import backup" }, { status: 500 });
        }
      },
    },
    "/api/petals": {
      POST: async (req) => {
        const { word, reading, meaning, partOfSpeech, language, conversationId, messageId, userInput, userImages, sourceType, youtubeTranslationId } = await req.json();

        // For YouTube sources, conversationId is optional
        const isYouTubeSource = sourceType === "youtube";
        if (!word || !language || !messageId) {
          return Response.json({ error: "Missing required fields" }, { status: 400 });
        }
        if (!isYouTubeSource && !conversationId) {
          return Response.json({ error: "Missing conversationId for chat source" }, { status: 400 });
        }

        // Check for duplicate
        if (isYouTubeSource && youtubeTranslationId) {
          if (petalExistsByYouTubeTranslation(youtubeTranslationId, word)) {
            return Response.json({ error: "Petal already exists", duplicate: true }, { status: 409 });
          }
        } else if (petalExists(messageId, word)) {
          return Response.json({ error: "Petal already exists", duplicate: true }, { status: 409 });
        }

        // Use the appropriate function based on source type
        if (isYouTubeSource) {
          const petal = createPetalWithSource(
            word,
            reading || "",
            meaning || "",
            partOfSpeech || "",
            language,
            conversationId || null,
            messageId,
            userInput || "",
            "youtube",
            youtubeTranslationId || null,
            userImages
          );
          return Response.json(petal);
        }

        const petal = createPetal(
          word,
          reading || "",
          meaning || "",
          partOfSpeech || "",
          language,
          conversationId,
          messageId,
          userInput || "",
          userImages
        );
        return Response.json(petal);
      },
    },
    "/api/petals/flowers": {
      GET: (req) => {
        const url = new URL(req.url);
        const language = url.searchParams.get("language") || "ja";
        const flowers = getFlowersByLanguage(language);
        return Response.json(flowers);
      },
    },
    "/api/petals/flower/:word": {
      GET: (req) => {
        const word = decodeURIComponent(req.params.word);
        const url = new URL(req.url);
        const language = url.searchParams.get("language") || "ja";
        const petals = getPetalsByWordAndLanguage(word, language);
        return Response.json(petals);
      },
    },
    "/api/petals/:id": {
      DELETE: (req) => {
        const id = req.params.id;
        const petal = getPetalById(id);
        if (!petal) {
          return Response.json({ error: "Petal not found" }, { status: 404 });
        }
        deletePetal(id);
        return Response.json({ success: true });
      },
    },
    "/api/petals/conversation/:conversationId": {
      GET: (req) => {
        const conversationId = req.params.conversationId;
        const petals = getPetalsByConversationId(conversationId);
        return Response.json(petals);
      },
    },
    "/api/petals/message/:messageId/word/:word": {
      DELETE: (req) => {
        const messageId = req.params.messageId;
        const word = decodeURIComponent(req.params.word);
        const deleted = deletePetalByMessageAndWord(messageId, word);
        if (!deleted) {
          return Response.json({ error: "Petal not found" }, { status: 404 });
        }
        return Response.json({ success: true });
      },
    },
    "/api/messages/:conversationId/:messageId/translation": {
      GET: (req) => {
        const { conversationId, messageId } = req.params;
        const message = getMessageById(conversationId, messageId);
        if (!message) {
          return Response.json({ error: "Message not found" }, { status: 404 });
        }
        const parsed = parseTranslationContent(message.content);
        if (parsed.type !== "translation") {
          return Response.json({ error: "No translation data in message" }, { status: 404 });
        }
        return Response.json(parsed.data);
      },
    },
    "/api/chat": {
      POST: async (req) => {
        const apiKey = Bun.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "API key not configured" }, { status: 401 });
        }

        const { messages, language } = await req.json();
        const teacherSettings = getTeacherSettings();
        const languageName = languageNames[language] || "Japanese";

        const personality = teacherSettings.personality || "Warm and encouraging. Be patient, explain concepts clearly with examples, correct mistakes gently, and celebrate progress.";
        const subtextName = language === "ja" ? "kana (hiragana/katakana readings)" : language === "zh" ? "pinyin" : "romanization";
        const systemPrompt = `You are ${teacherSettings.name}, a ${languageName} language teacher with the following personality:

<personality>
${personality}
</personality>

<instructions>
When the user sends you ${languageName} text to translate or break down (including text in images), respond using this EXACT JSON format wrapped in markers:

<<<TRANSLATION_START>>>
{
  "originalText": "the original ${languageName} text",
  "subtext": "${subtextName} for the entire phrase",
  "translation": "English translation",
  "breakdown": [
    {
      "word": "each word/particle",
      "reading": "pronunciation in ${subtextName}",
      "meaning": "English meaning",
      "partOfSpeech": "noun|verb|adjective|particle|adverb|conjunction|auxiliary|etc"
    }
  ],
  "grammarNotes": "Brief explanation of any notable grammar patterns, conjugations, or usage notes"
}
<<<TRANSLATION_END>>>

For ALL other interactions (questions, conversation, requests for examples, clarifications, etc.), respond naturally in plain text WITHOUT this format.
- If the user asks questions in ${languageName}, reply in ${languageName}.
- Otherwise, use English.
- When analyzing images containing ${languageName} text, extract the text and provide translation/breakdown.
</instructions>`;

        const anthropic = new Anthropic({ apiKey });

        // Filter out messages with empty content (except allow final assistant message to be empty)
        const filteredMessages = messages.filter((m: { role: string; content: string; images?: string[] }, index: number) => {
          const isLastMessage = index === messages.length - 1;
          const hasContent = m.content && m.content.trim().length > 0;
          const hasImages = m.images && m.images.length > 0;
          // Keep message if it has content, has images, or is the last assistant message
          return hasContent || hasImages || (isLastMessage && m.role === 'assistant');
        });

        // Transform messages to include images in Claude format
        const transformedMessages = await Promise.all(
          filteredMessages.map(async (m: { role: string; content: string; images?: string[] }) => {
            // If no images, return simple text message
            if (!m.images || m.images.length === 0) {
              return { role: m.role, content: m.content };
            }

            // Build content array with images and text
            const contentBlocks: Array<
              | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
              | { type: "text"; text: string }
            > = [];

            // Add images first
            for (const imageUrl of m.images) {
              const filename = imageUrl.replace("/api/uploads/", "");
              const filepath = join(uploadsDir, filename);
              const result = await getImageForApi(filepath, filename);

              if (result) {
                contentBlocks.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: result.mediaType,
                    data: result.base64,
                  },
                });
              }
            }

            // Add text content last (or a default prompt if no text)
            const text = m.content.trim() || "Please translate any text in this image.";
            contentBlocks.push({ type: "text", text });

            return { role: m.role, content: contentBlocks };
          })
        );

        // Compact messages to fit within API size limits (pure transformation, does not modify stored data)
        const compactionResult = compactMessages(systemPrompt, transformedMessages);
        // Add cache control to conversation history for prompt caching
        const finalMessages = addCacheControlToMessages(compactionResult.messages as MessageParam[]);

        if (compactionResult.wasCompacted) {
          console.log(
            `Compacted conversation: dropped ${compactionResult.droppedImageCount} images, ` +
            `${compactionResult.droppedMessageCount} messages`
          );
        }

        try {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: finalMessages,
          });

          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const event of stream) {
                  if (controller.desiredSize === null) {
                    // Controller is closed, stop processing
                    break;
                  }
                  const data = `data: ${JSON.stringify(event)}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                }
              } catch (error) {
                console.error("Stream error:", error);
                if (controller.desiredSize !== null) {
                  controller.error(error);
                }
              }
            },
          });

          return new Response(readable, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        } catch (error: unknown) {
          console.error("API error:", error);

          // Handle specific API errors
          if (error instanceof Anthropic.APIError) {
            if (error.status === 413) {
              return Response.json(
                {
                  error: "request_too_large",
                  message: "The conversation is too long. Please start a new conversation.",
                },
                { status: 413 }
              );
            }
            if (error.status === 429) {
              return Response.json(
                {
                  error: "rate_limited",
                  message: "Too many requests. Please wait a moment and try again.",
                },
                { status: 429 }
              );
            }
          }

          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/youtube/translate": {
      POST: async (req) => {
        const apiKey = Bun.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "API key not configured" }, { status: 401 });
        }

        const { imageBase64, language, videoId, videoTitle, timestamp } = await req.json();

        if (!imageBase64 || !language || !videoId) {
          return Response.json({ error: "Missing required fields" }, { status: 400 });
        }

        const languageName = languageNames[language] || "Japanese";
        const subtextName = language === "ja" ? "kana (hiragana/katakana readings)" : language === "zh" ? "pinyin" : "romanization";

        const systemPrompt = `You are a language learning assistant helping users understand text in video frames.

When analyzing an image:
1. Extract all visible text in ${languageName} (subtitles, captions, signs, UI text)
2. Provide translation with word-by-word breakdown
3. Focus on the primary/most prominent text

Respond using this EXACT JSON format wrapped in markers:

<<<TRANSLATION_START>>>
{
  "originalText": "the original ${languageName} text",
  "subtext": "${subtextName} for the entire phrase",
  "translation": "English translation",
  "breakdown": [
    {
      "word": "each word/particle",
      "reading": "pronunciation in ${subtextName}",
      "meaning": "English meaning",
      "partOfSpeech": "noun|verb|adjective|particle|adverb|conjunction|auxiliary|etc"
    }
  ],
  "grammarNotes": "Brief explanation of any notable grammar patterns, conjugations, or usage notes"
}
<<<TRANSLATION_END>>>

If there is no ${languageName} text visible in the image, respond with a brief message explaining what you see instead.`;

        // Create a translation record first (we'll update it with the full response later)
        const translationRecord = createYouTubeTranslation(
          videoId,
          videoTitle || null,
          timestamp || 0,
          imageBase64.substring(0, 10000), // Store a compressed preview of the image (first 10KB)
          "{}" // Placeholder, will be updated after translation
        );

        const anthropic = new Anthropic({ apiKey });

        try {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/png",
                      data: imageBase64,
                    },
                  },
                  {
                    type: "text",
                    text: `Please analyze this video frame and translate any ${languageName} text you see.`,
                  },
                ],
              },
            ],
          });

          let fullContent = "";
          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                // Send the translation ID first
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "translation_id", id: translationRecord.id })}\n\n`)
                );

                for await (const event of stream) {
                  if (controller.desiredSize === null) break;

                  // Track content for final storage
                  if (event.type === "content_block_delta") {
                    const delta = event.delta as { type: string; text?: string };
                    if (delta.type === "text_delta" && delta.text) {
                      fullContent += delta.text;
                    }
                  }

                  const data = `data: ${JSON.stringify(event)}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }

                // Update the translation record with the full response
                if (fullContent) {
                  updateYouTubeTranslationData(translationRecord.id, fullContent);
                }

                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                }
              } catch (error) {
                console.error("YouTube translate stream error:", error);
                if (controller.desiredSize !== null) {
                  controller.error(error);
                }
              }
            },
          });

          return new Response(readable, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        } catch (error: unknown) {
          console.error("YouTube translate API error:", error);
          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/youtube/translations/:id": {
      GET: (req) => {
        const id = req.params.id;
        const translation = getYouTubeTranslationById(id);
        if (!translation) {
          return Response.json({ error: "Translation not found" }, { status: 404 });
        }
        return Response.json({
          id: translation.id,
          videoId: translation.video_id,
          videoTitle: translation.video_title,
          timestampSeconds: translation.timestamp_seconds,
          frameImage: translation.frame_image,
          translationData: translation.translation_data,
        });
      },
    },
  },
  async fetch(req) {
    // Fallback: serve static files from embedded assets
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Default to index.html for root
    if (pathname === "/") {
      pathname = "/index.html";
    }

    // Try to serve embedded asset
    const asset = assets[pathname];
    if (asset) {
      const body = asset.binary
        ? Buffer.from(asset.content, "base64")
        : asset.content;
      return new Response(body, {
        headers: { "Content-Type": asset.contentType },
      });
    }

    // SPA fallback - serve index.html for client-side routing
    const indexAsset = assets["/index.html"];
    if (indexAsset && !pathname.startsWith("/api/")) {
      return new Response(indexAsset.content, {
        headers: { "Content-Type": indexAsset.contentType },
      });
    }

    return new Response("Not found", { status: 404 });
  },
  development: {
    hmr: true,
    console: true,
  },
});

const pink = "\x1b[38;2;236;72;153m"; // #EC4899
const reset = "\x1b[0m";

console.log(`\n🌸 ${pink}Blossom${reset} - ようこそ | 欢迎 | 환영합니다`);
console.log(`   Server running at ${pink}http://localhost:${server.port}${reset}\n`);
