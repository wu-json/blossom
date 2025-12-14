import index from "./index.html";
import Anthropic from "@anthropic-ai/sdk";

const server = Bun.serve({
  routes: {
    "/": index,
    "/api/status": {
      GET: () => Response.json({ hasApiKey: !!process.env.ANTHROPIC_API_KEY }),
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

        return new Response(stream.toReadableStream(), {
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
