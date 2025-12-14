import index from "./index.html";
import Anthropic from "@anthropic-ai/sdk";
import {
  createConversation,
  getConversations,
  getConversationById,
  updateConversationTitle,
  updateConversationTimestamp,
} from "./db/conversations";
import { createMessage, getMessagesByConversationId, updateMessageContent } from "./db/messages";
import {
  getTeacherSettings,
  updateTeacherName,
  updateTeacherProfileImage,
} from "./db/teacher";
import { blossomDir } from "./db/database";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

// Ensure uploads directory exists in ~/.blossom/uploads
const uploadsDir = join(blossomDir, "uploads");
await mkdir(uploadsDir, { recursive: true });

const languageNames: Record<string, string> = {
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
};

const server = Bun.serve({
  routes: {
    "/": index,
    "/api/status": {
      GET: () => Response.json({ anthropicConfigured: !!process.env.ANTHROPIC_API_KEY }),
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

        const messages = getMessagesByConversationId(id);
        if (messages.length === 0) {
          return Response.json({ error: "No messages in conversation" }, { status: 400 });
        }

        // Generate title using Haiku
        const anthropic = new Anthropic({ apiKey });
        const summary = messages.slice(0, 4).map(m => `${m.role}: ${m.content}`).join("\n");

        const response = await anthropic.messages.create({
          model: "claude-3-5-haiku-latest",
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: `Generate a short, concise title (max 5 words) for this conversation. Return ONLY the title, no quotes or punctuation:\n\n${summary}`,
            },
          ],
        });

        const title = (response.content[0] as { type: string; text: string }).text.trim();
        updateConversationTitle(id, title);

        return Response.json({ title });
      },
    },
    "/api/conversations/:id/messages": {
      POST: async (req) => {
        const id = req.params.id;
        const conversation = getConversationById(id);
        if (!conversation) {
          return Response.json({ error: "Conversation not found" }, { status: 404 });
        }

        const { role, content, messageId } = await req.json();

        // If messageId provided, update existing message; otherwise create new
        if (messageId) {
          updateMessageContent(messageId, content);
          updateConversationTimestamp(id);
          return Response.json({ id: messageId, role, content });
        }

        const message = createMessage(id, role, content);
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
    "/api/uploads/:filename": {
      GET: async (req) => {
        const filename = req.params.filename;
        // Prevent path traversal
        if (filename.includes("..") || filename.includes("/")) {
          return new Response("Not found", { status: 404 });
        }
        const filePath = join(uploadsDir, filename);
        console.log("Serving file:", filePath);
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file);
        }
        console.log("File not found:", filePath);
        return new Response("Not found", { status: 404 });
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
        const systemPrompt = `You are ${teacherSettings.name}, a warm and encouraging ${languageName} language learning assistant. Be patient, explain concepts clearly with examples, correct mistakes gently, and celebrate progress.`;

        const anthropic = new Anthropic({ apiKey });

        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const event of stream) {
                const data = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
            "Connection": "keep-alive",
          },
        });
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at http://localhost:${server.port}`);
