#!/usr/bin/env bun
// Generates src/native/sharp-bindings.ts for the current platform
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
console.log(`Generating sharp bindings for: ${platformKey}`);

const content = `// Auto-generated for ${platformKey} - do not edit directly
// Run \`bun scripts/generate-sharp-bindings.ts\` to regenerate

export { extractSharpBindings } from "./${platformKey}";
`;

const outPath = join(import.meta.dir, "../src/native/sharp-bindings.ts");
writeFileSync(outPath, content);
console.log(`Written to: ${outPath}`);
