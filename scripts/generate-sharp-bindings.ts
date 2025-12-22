#!/usr/bin/env bun
// Generates src/generated/sharp-bindings.ts for the current platform
// Run before build to ensure only the correct platform's bindings are bundled

import { arch, platform } from "node:os";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function getPlatformKey(): string {
  const p = platform();
  const a = arch();

  if (p === "darwin" && a === "arm64") return "darwin-arm64";
  if (p === "darwin" && a === "x64") return "darwin-x64";
  if (p === "linux" && a === "arm64") return "linux-arm64";
  if (p === "linux" && a === "x64") return "linux-x64";

  throw new Error(`Unsupported platform: ${p}-${a}`);
}

const platformKey = getPlatformKey();
const isDarwin = platformKey.startsWith("darwin");
const libvipsFilename = isDarwin ? "libvips-cpp.8.17.3.dylib" : "libvips-cpp.so.8.17.3";

console.log(`Generating sharp bindings for: ${platformKey}`);

const content = `// Auto-generated for ${platformKey} - do not edit directly
// Run \`bun scripts/generate-sharp-bindings.ts\` to regenerate

import { join } from "node:path";
import { mkdir, chmod } from "node:fs/promises";

// Embed native files - Bun stores these in $bunfs, not JS heap
// @ts-ignore - Bun-specific import with type: "file"
import sharpNodePath from "../../node_modules/@img/sharp-${platformKey}/lib/sharp-${platformKey}.node" with { type: "file" };
// @ts-ignore - Bun-specific import with type: "file"
import libvipsPath from "../../node_modules/@img/sharp-libvips-${platformKey}/lib/${libvipsFilename}" with { type: "file" };

const PLATFORM = "${platformKey}";
const LIBVIPS_FILENAME = "${libvipsFilename}";

export async function extractSharpBindings(): Promise<void> {
  const blossomDir = process.env.BLOSSOM_DATA_DIR || join(process.env.HOME!, ".blossom");
  const nativeDir = join(blossomDir, "native", "@img");

  const sharpDir = join(nativeDir, \`sharp-\${PLATFORM}\`, "lib");
  const libvipsDir = join(nativeDir, \`sharp-libvips-\${PLATFORM}\`, "lib");

  await mkdir(sharpDir, { recursive: true });
  await mkdir(libvipsDir, { recursive: true });

  // Extract .node file from $bunfs to real filesystem
  const sharpDest = join(sharpDir, \`sharp-\${PLATFORM}.node\`);
  if (!(await Bun.file(sharpDest).exists())) {
    const data = await Bun.file(sharpNodePath).arrayBuffer();
    await Bun.write(sharpDest, data);
    await chmod(sharpDest, 0o755);
  }

  // Extract libvips
  const libvipsDest = join(libvipsDir, LIBVIPS_FILENAME);
  if (!(await Bun.file(libvipsDest).exists())) {
    const data = await Bun.file(libvipsPath).arrayBuffer();
    await Bun.write(libvipsDest, data);
    await chmod(libvipsDest, 0o755);
  }
}
`;

const outPath = join(import.meta.dir, "../src/generated/sharp-bindings.ts");
writeFileSync(outPath, content);
console.log(`Written to: ${outPath}`);
