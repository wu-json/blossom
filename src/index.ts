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
    "/api/chat": {
      POST: async (req) => {
        const apiKey = Bun.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "API key not configured" }, { status: 401 });
        }

        const { messages } = await req.json();

        const anthropic = new Anthropic({ apiKey });

        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
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
