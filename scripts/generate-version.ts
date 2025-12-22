#!/usr/bin/env bun
// Generates generated/version.ts from package.json version

import { join } from "node:path";

const rootDir = join(import.meta.dir, "..");
const packageJson = await Bun.file(join(rootDir, "package.json")).json();
const version = packageJson.version;

const content = `// Auto-generated from package.json - do not edit directly
// Run \`bun scripts/generate-version.ts\` to regenerate
export const version = "${version}";
`;

const outPath = join(rootDir, "generated/version.ts");
await Bun.write(outPath, content);
console.log(`Generated ${outPath} with version ${version}`);
