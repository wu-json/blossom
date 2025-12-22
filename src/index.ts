import Anthropic from "@anthropic-ai/sdk";
import {
  createConversation,
  getConversations,
  getConversationById,
  updateConversationTitle,
  updateConversationTimestamp,
  deleteConversation,
} from "./db/conversations";
import { getLLMSettings, updateLLMSettings } from "./db/llm-settings";
import { getProvider } from "./lib/llm/get-provider";
import { OllamaProvider } from "./lib/llm/ollama";
import type { LLMMessage } from "./lib/llm/types";
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
} from "./db/petals";
import {
  createYouTubeTranslation,
  getYouTubeTranslationById,
  getYouTubeTranslationsByVideoId,
  updateYouTubeTranslation,
  updateYouTubeTranslationTimestamp,
  getRecentlyTranslatedVideos,
  getRecentlyTranslatedVideosCount,
} from "./db/youtube-translations";
import { extractAndSaveFrame, compressFrameForApi, framesDir, ensureVideoTools, precacheStreamUrl } from "./lib/video-tools";
import { db, blossomDir } from "./db/database";
import { compactMessages } from "./lib/message-compaction";
import { getImageForApi, type ImageMediaType } from "./lib/image-compression";
import { mkdir, unlink, rm, rename } from "node:fs/promises";
import archiver from "archiver";
import unzipper from "unzipper";
import { join } from "node:path";
import { assets, getAssetPath } from "./generated/embedded-assets";

const uploadsDir = join(blossomDir, "uploads");
await mkdir(uploadsDir, { recursive: true });

await ensureVideoTools();

const languageNames: Record<string, string> = {
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
};

const server = Bun.serve({
  idleTimeout: 120, // 120 seconds for streaming responses
  routes: {
    "/api/status": {
      GET: async () => {
        const apiKey = Bun.env.ANTHROPIC_API_KEY;
        const maskedKey = apiKey ? `...${apiKey.slice(-6)}` : null;
        const llmSettings = getLLMSettings();

        let ollamaAvailable = false;
        if (llmSettings.provider === "ollama") {
          const provider = new OllamaProvider(llmSettings.ollamaUrl);
          ollamaAvailable = await provider.isAvailable();
        }

        return Response.json({
          llmProvider: llmSettings.provider,
          chatModel: llmSettings.chatModel,
          titleModel: llmSettings.titleModel,
          anthropicConfigured: !!apiKey,
          anthropicKeyPreview: maskedKey,
          ollamaUrl: llmSettings.ollamaUrl,
          ollamaAvailable,
          dataDir: blossomDir,
        });
      },
    },
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
        const llmSettings = getLLMSettings();
        const providerResult = getProvider();

        if ("error" in providerResult) {
          return Response.json({ error: providerResult.error }, { status: 401 });
        }
        const provider = providerResult;

        const id = req.params.id;
        const conversation = getConversationById(id);
        if (!conversation) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }

        let language = "ja";
        try {
          const body = await req.json();
          if (body.language) language = body.language;
        } catch {}

        const languageNameMap: Record<string, string> = {
          ja: "Japanese",
          zh: "Chinese",
          ko: "Korean",
        };
        const languageName = languageNameMap[language] || "Japanese";

        const messages = getMessagesByConversationId(id);
        if (messages.length === 0) {
          return Response.json({ error: "No messages in conversation" }, { status: 400 });
        }

        // Filter messages with content or images
        const filteredMessages = messages.filter((m) => {
          const hasContent = m.content && m.content.trim().length > 0;
          const hasImages = m.images && m.images.length > 0;
          return hasContent || hasImages;
        });

        // Transform messages to LLM format with images as base64
        const llmMessages: LLMMessage[] = await Promise.all(
          filteredMessages.map(async (m) => {
            const images: string[] = [];

            if (m.images && m.images.length > 0) {
              for (const imageUrl of m.images) {
                const filename = imageUrl.replace("/api/uploads/", "");
                const filepath = join(uploadsDir, filename);
                const result = await getImageForApi(filepath, filename);

                if (result) {
                  images.push(`data:${result.mediaType};base64,${result.base64}`);
                }
              }
            }

            return {
              role: m.role as "user" | "assistant",
              content: m.content || "",
              images: images.length > 0 ? images : undefined,
            };
          })
        );

        // Filter out messages with empty content
        const validMessages = llmMessages.filter(m => m.content.length > 0 || (m.images && m.images.length > 0));

        // Apply compaction
        const { messages: compactedMessages } = compactMessages("", validMessages.map(m => ({
          role: m.role,
          content: m.images?.length
            ? [
                ...m.images.map(img => {
                  const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
                  return {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: (match?.[1] || "image/png") as ImageMediaType,
                      data: match?.[2] || img,
                    },
                  };
                }),
                { type: "text" as const, text: m.content },
              ]
            : m.content,
        })));

        // Convert compacted messages back to LLMMessage format
        const compactedLLMMessages: LLMMessage[] = compactedMessages.map(m => {
          if (typeof m.content === "string") {
            return { role: m.role as "user" | "assistant", content: m.content };
          }
          const images: string[] = [];
          let text = "";
          for (const block of m.content as Array<{ type: string; source?: { media_type: string; data: string }; text?: string }>) {
            if (block.type === "image" && block.source) {
              images.push(`data:${block.source.media_type};base64,${block.source.data}`);
            } else if (block.type === "text" && block.text) {
              text = block.text;
            }
          }
          return {
            role: m.role as "user" | "assistant",
            content: text,
            images: images.length > 0 ? images : undefined,
          };
        });

        // Add the title generation instruction as the final user message
        compactedLLMMessages.push({
          role: "user",
          content: `Based on this conversation, generate a short, concise title (max 5 words) in ${languageName}. Focus primarily on the most recent messages to capture the current topic. Return ONLY the title, no quotes or punctuation.`,
        });

        try {
          const title = await provider.complete({
            model: llmSettings.titleModel,
            messages: compactedLLMMessages,
            system: "",
            maxTokens: 50,
          });

          const cleanTitle = title.trim();
          updateConversationTitle(id, cleanTitle);

          return Response.json({ title: cleanTitle });
        } catch (error) {
          console.error("Title generation error:", error);

          // Handle Ollama-specific errors
          if (llmSettings.provider === "ollama") {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
              return Response.json(
                { error: "Cannot connect to Ollama. Make sure Ollama is running." },
                { status: 503 }
              );
            }
          }

          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
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

        const currentSettings = getTeacherSettings();
        if (currentSettings.profile_image_path) {
          try {
            const oldFilename = currentSettings.profile_image_path.replace("/api/uploads/", "");
            const oldFilePath = join(uploadsDir, oldFilename);
            await unlink(oldFilePath);
          } catch {}
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
            const filename = settings.profile_image_path.replace("/api/uploads/", "");
            const filePath = join(uploadsDir, filename);
            await unlink(filePath);
          } catch {}
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

        if (!word || !language || !conversationId || !messageId) {
          return Response.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check for duplicate (same word in same message)
        if (petalExists(messageId, word)) {
          return Response.json({ error: "Petal already exists", duplicate: true }, { status: 409 });
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
          userImages,
          sourceType || "chat",
          youtubeTranslationId
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
    "/api/youtube/extract-frame": {
      POST: async (req) => {
        try {
          const { videoId, timestamp } = await req.json();

          if (!videoId || typeof timestamp !== "number") {
            return Response.json({ error: "Missing videoId or timestamp" }, { status: 400 });
          }

          // Extract high-quality frame and save to disk
          const filename = await extractAndSaveFrame(videoId, timestamp);

          return Response.json({ filename });
        } catch (error) {
          console.error("Frame extraction error:", error);
          const message = error instanceof Error ? error.message : "Failed to extract frame";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/youtube/precache-stream": {
      POST: async (req) => {
        try {
          const { videoId } = await req.json();
          if (!videoId) {
            return Response.json({ error: "Missing videoId" }, { status: 400 });
          }
          // Fire and forget - don't wait for completion
          precacheStreamUrl(videoId).catch((err) => {
            console.error("Failed to precache stream:", err);
          });
          return Response.json({ status: "caching" });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/youtube/frames/:filename": {
      GET: async (req) => {
        const filename = req.params.filename;
        const filepath = `${framesDir}/${filename}`;
        const file = Bun.file(filepath);

        if (!(await file.exists())) {
          return Response.json({ error: "Frame not found" }, { status: 404 });
        }

        const contentType = filename.endsWith(".png") ? "image/png" : "image/jpeg";
        return new Response(file, {
          headers: { "Content-Type": contentType },
        });
      },
    },
    "/api/youtube/recent-videos": {
      GET: (req) => {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);

        const videos = getRecentlyTranslatedVideos(Math.min(limit, 50), offset);
        const total = getRecentlyTranslatedVideosCount();

        return Response.json({
          videos,
          total,
          hasMore: offset + videos.length < total,
        });
      },
    },
    "/api/youtube/translations": {
      GET: (req) => {
        const url = new URL(req.url);
        const videoId = url.searchParams.get("videoId");

        if (!videoId) {
          return Response.json({ error: "videoId required" }, { status: 400 });
        }

        const translations = getYouTubeTranslationsByVideoId(videoId);

        // Transform to client format
        const clientTranslations = translations.map((t) => ({
          id: t.id,
          videoId: t.video_id,
          videoTitle: t.video_title,
          timestampSeconds: t.timestamp_seconds,
          frameImage: t.frame_image ? `/api/youtube/frames/${t.frame_image}` : null,
          translationData: t.translation_data ? JSON.parse(t.translation_data) : null,
          createdAt: t.created_at,
        }));

        return Response.json({ translations: clientTranslations });
      },
      POST: async (req) => {
        try {
          const { videoId, videoTitle, timestampSeconds, frameFilename, translationData } = await req.json();

          if (!videoId || typeof timestampSeconds !== "number") {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
          }

          const translation = createYouTubeTranslation(
            videoId,
            videoTitle || null,
            timestampSeconds,
            frameFilename || null,
            translationData ? JSON.stringify(translationData) : null
          );

          return Response.json(translation);
        } catch (error) {
          console.error("Create YouTube translation error:", error);
          return Response.json({ error: "Failed to create translation" }, { status: 500 });
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

        // Convert filename to URL for client
        const frameUrl = translation.frame_image
          ? `/api/youtube/frames/${translation.frame_image}`
          : null;

        return Response.json({
          ...translation,
          frame_image: frameUrl,
          translation_data: translation.translation_data
            ? JSON.parse(translation.translation_data)
            : null,
        });
      },
      PUT: async (req) => {
        const id = req.params.id;
        const { translationData, frameImage, timestampSeconds } = await req.json();

        // Handle timestamp update if provided
        if (timestampSeconds !== undefined) {
          const timestampSuccess = updateYouTubeTranslationTimestamp(id, timestampSeconds);
          if (!timestampSuccess) {
            return Response.json({ error: "Translation not found" }, { status: 404 });
          }
          // If only updating timestamp, return early
          if (translationData === undefined && frameImage === undefined) {
            return Response.json({ success: true });
          }
        }

        const success = updateYouTubeTranslation(
          id,
          translationData ? JSON.stringify(translationData) : null,
          frameImage
        );

        if (!success) {
          return Response.json({ error: "Translation not found" }, { status: 404 });
        }

        return Response.json({ success: true });
      },
    },
    "/api/youtube/translate": {
      POST: async (req) => {
        const llmSettings = getLLMSettings();
        const providerResult = getProvider();

        if ("error" in providerResult) {
          return Response.json({ error: providerResult.error }, { status: 401 });
        }
        const provider = providerResult;

        const { filename, language } = await req.json();

        if (!filename) {
          return Response.json({ error: "Missing filename" }, { status: 400 });
        }

        // Compress the frame for API (smaller file = faster + cheaper)
        const compressedBuffer = await compressFrameForApi(filename);
        const imageBase64 = compressedBuffer.toString("base64");

        const languageName = languageNames[language] || "Japanese";
        const subtextName = language === "ja" ? "kana (hiragana/katakana readings)" : language === "zh" ? "pinyin" : "romanization";
        const readingInstruction = language === "ja"
          ? "hiragana reading (e.g., にほん, いく, たべる)"
          : language === "zh"
          ? "pinyin with tone marks"
          : "romanization";

        const systemPrompt = `You are a language learning assistant helping users understand text in video frames.

When analyzing an image:
1. Extract all visible text (subtitles, captions, signs, UI text)
2. Provide translation with word-by-word breakdown
3. Focus on the primary/most prominent ${languageName} text

Respond using this EXACT JSON format wrapped in markers:

<<<TRANSLATION_START>>>
{
  "originalText": "the original ${languageName} text",
  "subtext": "${subtextName} for the entire phrase",
  "translation": "English translation",
  "breakdown": [
    {
      "word": "each word/particle",
      "reading": "${readingInstruction}",
      "meaning": "English meaning",
      "partOfSpeech": "noun|verb|adjective|particle|adverb|conjunction|auxiliary|etc"
    }
  ],
  "grammarNotes": "Brief explanation of any notable grammar patterns, conjugations, or usage notes"
}
<<<TRANSLATION_END>>>

Example breakdown entry${language === "ja" ? `: { "word": "日本", "reading": "にほん", "meaning": "Japan", "partOfSpeech": "noun" }` : language === "zh" ? `: { "word": "中国", "reading": "zhōngguó", "meaning": "China", "partOfSpeech": "noun" }` : ""}

Omit punctuation (commas, periods, exclamation points, etc.) from the breakdown.

If there is no ${languageName} text visible in the image, respond with a brief message explaining that no text was found.`;

        try {
          const stream = provider.stream({
            model: llmSettings.chatModel,
            messages: [
              {
                role: "user",
                content: `Please analyze this video frame and translate any ${languageName} text you see.`,
                images: [`data:image/jpeg;base64,${imageBase64}`],
              },
            ],
            system: systemPrompt,
            maxTokens: 4096,
          });

          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const text of stream) {
                  if (controller.desiredSize === null) {
                    break;
                  }
                  // Emit in Anthropic-compatible format for frontend compatibility
                  const event = {
                    type: "content_block_delta",
                    delta: { type: "text_delta", text },
                  };
                  const data = `data: ${JSON.stringify(event)}\n\n`;
                  controller.enqueue(encoder.encode(data));
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
              Connection: "keep-alive",
            },
          });
        } catch (error: unknown) {
          console.error("YouTube translate API error:", error);

          // Handle Ollama-specific errors
          if (llmSettings.provider === "ollama") {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
              return Response.json(
                { error: "Cannot connect to Ollama. Make sure Ollama is running." },
                { status: 503 }
              );
            }
          }

          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/chat": {
      POST: async (req) => {
        const llmSettings = getLLMSettings();
        const providerResult = getProvider();

        if ("error" in providerResult) {
          return Response.json({ error: providerResult.error }, { status: 401 });
        }
        const provider = providerResult;

        const { messages, language } = await req.json();
        const teacherSettings = getTeacherSettings();
        const languageName = languageNames[language] || "Japanese";

        const personality = teacherSettings.personality || "Warm and encouraging. Be patient, explain concepts clearly with examples, correct mistakes gently, and celebrate progress.";
        const subtextName = language === "ja" ? "kana (hiragana/katakana readings)" : language === "zh" ? "pinyin" : "romanization";
        const readingInstruction = language === "ja"
          ? "hiragana reading (e.g., にほん, いく, たべる)"
          : language === "zh"
          ? "pinyin with tone marks"
          : "romanization";
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
      "reading": "${readingInstruction}",
      "meaning": "English meaning",
      "partOfSpeech": "noun|verb|adjective|particle|adverb|conjunction|auxiliary|etc"
    }
  ],
  "grammarNotes": "Brief explanation of any notable grammar patterns, conjugations, or usage notes"
}
<<<TRANSLATION_END>>>

Example breakdown entry${language === "ja" ? `: { "word": "日本", "reading": "にほん", "meaning": "Japan", "partOfSpeech": "noun" }` : language === "zh" ? `: { "word": "中国", "reading": "zhōngguó", "meaning": "China", "partOfSpeech": "noun" }` : ""}

Omit punctuation (commas, periods, exclamation points, etc.) from the breakdown.

For ALL other interactions (questions, conversation, requests for examples, clarifications, etc.), respond naturally in plain text WITHOUT this format.
- If the user asks questions in ${languageName}, reply in ${languageName}.
- Otherwise, use English.
- When analyzing images containing ${languageName} text, extract the text and provide translation/breakdown.
</instructions>`;

        // Filter out messages with empty content (except allow final assistant message to be empty)
        const filteredMessages = messages.filter((m: { role: string; content: string; images?: string[] }, index: number) => {
          const isLastMessage = index === messages.length - 1;
          const hasContent = m.content && m.content.trim().length > 0;
          const hasImages = m.images && m.images.length > 0;
          // Keep message if it has content, has images, or is the last assistant message
          return hasContent || hasImages || (isLastMessage && m.role === 'assistant');
        });

        // Transform messages to LLM format with images as base64
        const llmMessages: LLMMessage[] = await Promise.all(
          filteredMessages.map(async (m: { role: string; content: string; images?: string[] }) => {
            const images: string[] = [];

            if (m.images && m.images.length > 0) {
              for (const imageUrl of m.images) {
                const filename = imageUrl.replace("/api/uploads/", "");
                const filepath = join(uploadsDir, filename);
                const result = await getImageForApi(filepath, filename);

                if (result) {
                  // Include data URI prefix for the provider to parse
                  images.push(`data:${result.mediaType};base64,${result.base64}`);
                }
              }
            }

            const content = m.content.trim() || (images.length > 0 ? "Please translate any text in this image." : "");

            return {
              role: m.role as "user" | "assistant",
              content,
              images: images.length > 0 ? images : undefined,
            };
          })
        );

        // Compact messages to fit within API size limits
        const compactionResult = compactMessages(systemPrompt, llmMessages.map(m => ({
          role: m.role,
          content: m.images?.length
            ? [
                ...m.images.map(img => {
                  const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
                  return {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: (match?.[1] || "image/png") as ImageMediaType,
                      data: match?.[2] || img,
                    },
                  };
                }),
                { type: "text" as const, text: m.content },
              ]
            : m.content,
        })));

        if (compactionResult.wasCompacted) {
          console.log(
            `Compacted conversation: dropped ${compactionResult.droppedImageCount} images, ` +
            `${compactionResult.droppedMessageCount} messages`
          );
        }

        // Convert compacted messages back to LLMMessage format
        const compactedLLMMessages: LLMMessage[] = compactionResult.messages.map(m => {
          if (typeof m.content === "string") {
            return { role: m.role as "user" | "assistant", content: m.content };
          }
          // Extract images and text from content blocks
          const images: string[] = [];
          let text = "";
          for (const block of m.content as Array<{ type: string; source?: { media_type: string; data: string }; text?: string }>) {
            if (block.type === "image" && block.source) {
              images.push(`data:${block.source.media_type};base64,${block.source.data}`);
            } else if (block.type === "text" && block.text) {
              text = block.text;
            }
          }
          return {
            role: m.role as "user" | "assistant",
            content: text,
            images: images.length > 0 ? images : undefined,
          };
        });

        try {
          const stream = provider.stream({
            model: llmSettings.chatModel,
            messages: compactedLLMMessages,
            system: systemPrompt,
            maxTokens: 4096,
          });

          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const text of stream) {
                  if (controller.desiredSize === null) {
                    break;
                  }
                  // Emit in Anthropic-compatible format for frontend compatibility
                  const event = {
                    type: "content_block_delta",
                    delta: { type: "text_delta", text },
                  };
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

          // Handle Ollama-specific errors
          if (llmSettings.provider === "ollama") {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
              return Response.json(
                { error: "Cannot connect to Ollama. Make sure Ollama is running." },
                { status: 503 }
              );
            }
            if (errorMessage.includes("model") && errorMessage.includes("not found")) {
              return Response.json(
                { error: `Model "${llmSettings.chatModel}" not found. Run: ollama pull ${llmSettings.chatModel}` },
                { status: 400 }
              );
            }
          }

          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
  async fetch(req) {
    // Fallback: serve static files from embedded assets
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname === "/") {
      pathname = "/index.html";
    }

    // Try to serve embedded asset (assets contains file paths or HTMLBundle)
    const asset = assets[pathname];
    if (asset) {
      // Hashed assets (in /assets/) can be cached forever
      // index.html should not be cached (may reference new hashed assets)
      const isHashedAsset = pathname.startsWith("/assets/");
      const cacheControl = isHashedAsset
        ? "public, max-age=31536000, immutable"
        : "no-cache";

      return new Response(Bun.file(getAssetPath(asset)), {
        headers: { "Cache-Control": cacheControl },
      });
    }

    // SPA fallback - serve index.html for client-side routing
    const indexAsset = assets["/index.html"];
    if (indexAsset && !pathname.startsWith("/api/")) {
      return new Response(Bun.file(getAssetPath(indexAsset)), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        },
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

console.log(`\n🌸 ${pink}Blossom${reset} - language as a meadow`);
console.log(`   Server running at ${pink}http://localhost:${server.port}${reset}\n`);

// Warm up Ollama models if configured
async function warmOllamaIfNeeded() {
  const settings = getLLMSettings();
  if (settings.provider !== "ollama") return;

  try {
    const provider = new OllamaProvider(settings.ollamaUrl);

    // Check if Ollama is available first
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) return;

    // Send minimal request to load chatModel into memory
    await provider.complete({
      model: settings.chatModel,
      messages: [{ role: "user", content: "hi" }],
      system: "",
      maxTokens: 1,
    });

    // Also warm titleModel if different
    if (settings.titleModel !== settings.chatModel) {
      await provider.complete({
        model: settings.titleModel,
        messages: [{ role: "user", content: "hi" }],
        system: "",
        maxTokens: 1,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to warm Ollama: ${message}`);
  }
}

// Run warm-up in background (non-blocking)
warmOllamaIfNeeded();
