import { serve, file } from "bun";
import { join } from "path";

const distDir = join(import.meta.dir, "dist");

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Default to index.html for root
    if (pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = join(distDir, pathname);
    const f = file(filePath);

    if (await f.exists()) {
      return new Response(f);
    }

    // SPA fallback - serve index.html for client-side routing
    const indexFile = file(join(distDir, "index.html"));
    if (await indexFile.exists()) {
      return new Response(indexFile);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🌸 Blossom running at http://localhost:${server.port}`);
