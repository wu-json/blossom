# Embedded Sharp Native Bindings

## Problem

Sharp is used for image compression before sending images to the Anthropic API (`src/lib/image-compression.ts`). When building Blossom as a single binary with `bun build --compile`, sharp fails to load because:

1. Native `.node` files cannot be embedded in the binary
2. The `.node` file depends on `libvips-cpp.dylib` which must exist on disk
3. The OS dynamic linker (`dlopen`) requires real filesystem paths

## Investigation Findings

- `require()` with absolute path works for `.node` files in compiled binaries
- The `.node` file finds `libvips-cpp.dylib` via `@rpath` relative to its location
- `NODE_PATH` modification does NOT work for scoped packages (`@img/...`) in Bun
- `require.cache` injection works in dev but not in compiled binaries (different cache keys)

## Solution

**Hybrid approach:**
1. Embed native bindings as base64 during build
2. Extract at runtime to `~/.blossom/native/`
3. Create a minimal wrapper that loads the native module directly (bypassing npm's sharp loader)
4. Use wrapper in compiled mode, use npm sharp in dev mode

## Architecture

### Files to Embed (per platform)

| Platform | .node file | libvips dylib | Total |
|----------|-----------|---------------|-------|
| darwin-arm64 | 256KB | 15MB | ~15MB |
| darwin-x64 | 256KB | 15MB | ~15MB |
| linux-x64 | 256KB | 15MB | ~15MB |
| linux-arm64 | 256KB | 15MB | ~15MB |

Each binary only includes its own platform's files.

### Directory Structure After Extraction

```
~/.blossom/
  native/
    @img/
      sharp-darwin-arm64/
        lib/
          sharp-darwin-arm64.node
      sharp-libvips-darwin-arm64/
        lib/
          libvips-cpp.8.17.3.dylib
```

This structure matches sharp's rpath expectations (verified via `otool -l`).

## Implementation

### Step 1: Build Script for Embedding Native Binaries

Create `scripts/embed-sharp-bindings.ts`:

```typescript
/**
 * Embeds platform-specific sharp native bindings as base64.
 * Run with: SHARP_PLATFORM=darwin-arm64 bun run scripts/embed-sharp-bindings.ts
 */
import { join } from "node:path";

const platform = process.env.SHARP_PLATFORM;
if (!platform) {
  console.error("SHARP_PLATFORM environment variable required");
  process.exit(1);
}

const rootDir = join(import.meta.dir, "..");
const nodeModules = join(rootDir, "node_modules", "@img");

// Platform-specific package names
const sharpPkg = `sharp-${platform}`;
const libvipsPkg = `sharp-libvips-${platform}`;

// Read the .node file
const nodeFile = join(nodeModules, sharpPkg, "lib", `sharp-${platform}.node`);
const nodeBuffer = await Bun.file(nodeFile).arrayBuffer();
const nodeBase64 = Buffer.from(nodeBuffer).toString("base64");

// Read the libvips dylib (name varies by platform)
const libvipsDir = join(nodeModules, libvipsPkg, "lib");
const libvipsFiles = await Array.fromAsync(
  new Bun.Glob("libvips-cpp.*").scan({ cwd: libvipsDir })
);
const libvipsName = libvipsFiles[0]; // e.g., "libvips-cpp.8.17.3.dylib" or "libvips-cpp.so.8.17.3"
const libvipsFile = join(libvipsDir, libvipsName);
const libvipsBuffer = await Bun.file(libvipsFile).arrayBuffer();
const libvipsBase64 = Buffer.from(libvipsBuffer).toString("base64");

// Generate TypeScript module
const output = `// Auto-generated - do not edit
// Platform: ${platform}

export const SHARP_PLATFORM = "${platform}";
export const SHARP_NODE_FILENAME = "sharp-${platform}.node";
export const LIBVIPS_FILENAME = "${libvipsName}";

export const SHARP_NODE_BASE64 = "${nodeBase64}";
export const LIBVIPS_BASE64 = "${libvipsBase64}";
`;

const outputFile = join(rootDir, "src", "generated", "sharp-bindings.ts");
await Bun.write(outputFile, output);
console.log(`Generated ${outputFile} for ${platform}`);
console.log(`  .node file: ${(nodeBuffer.byteLength / 1024).toFixed(0)}KB`);
console.log(`  libvips: ${(libvipsBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
```

### Step 2: Runtime Extraction Module

Create `src/lib/sharp-loader.ts`:

```typescript
/**
 * Extracts embedded sharp bindings at runtime and configures module resolution.
 * Must be called BEFORE importing sharp.
 */
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

let extracted = false;

export async function ensureSharpBindings(): Promise<boolean> {
  if (extracted) return true;

  // Only needed in compiled binary mode
  // In dev, sharp loads from node_modules normally
  const isCompiled = process.execPath.includes("blossom");
  if (!isCompiled) {
    extracted = true;
    return true;
  }

  try {
    // Dynamic import to avoid bundling in dev
    const bindings = await import("../generated/sharp-bindings");

    const blossomDir = process.env.BLOSSOM_DATA_DIR || join(process.env.HOME!, ".blossom");
    const nativeDir = join(blossomDir, "native", "@img");

    const sharpDir = join(nativeDir, `sharp-${bindings.SHARP_PLATFORM}`, "lib");
    const libvipsDir = join(nativeDir, `sharp-libvips-${bindings.SHARP_PLATFORM}`, "lib");

    // Create directories
    await mkdir(sharpDir, { recursive: true });
    await mkdir(libvipsDir, { recursive: true });

    // Extract .node file
    const nodeFilePath = join(sharpDir, bindings.SHARP_NODE_FILENAME);
    const nodeFile = Bun.file(nodeFilePath);
    if (!(await nodeFile.exists())) {
      const nodeBuffer = Buffer.from(bindings.SHARP_NODE_BASE64, "base64");
      await Bun.write(nodeFilePath, nodeBuffer);
      // Make executable
      const { chmod } = await import("node:fs/promises");
      await chmod(nodeFilePath, 0o755);
    }

    // Extract libvips
    const libvipsFilePath = join(libvipsDir, bindings.LIBVIPS_FILENAME);
    const libvipsFile = Bun.file(libvipsFilePath);
    if (!(await libvipsFile.exists())) {
      const libvipsBuffer = Buffer.from(bindings.LIBVIPS_BASE64, "base64");
      await Bun.write(libvipsFilePath, libvipsBuffer);
      await (await import("node:fs/promises")).chmod(libvipsFilePath, 0o755);
    }

    // Add to NODE_PATH so require('@img/sharp-...') resolves
    const existingPath = process.env.NODE_PATH || "";
    process.env.NODE_PATH = join(blossomDir, "native") +
      (existingPath ? `:${existingPath}` : "");

    // Force module resolution cache refresh
    // @ts-ignore
    require("module").Module._initPaths();

    extracted = true;
    return true;
  } catch (err) {
    console.warn("Failed to extract sharp bindings:", err);
    return false;
  }
}
```

### Step 3: Modify Image Compression to Use Loader

Update `src/lib/image-compression.ts`:

```typescript
import { ensureSharpBindings } from "./sharp-loader";

let sharp: typeof import("sharp") | null = null;
let sharpLoadAttempted = false;

async function getSharp() {
  if (sharpLoadAttempted) return sharp;
  sharpLoadAttempted = true;

  try {
    await ensureSharpBindings();
    sharp = (await import("sharp")).default;
  } catch (err) {
    console.warn("Sharp not available, image compression disabled:", err);
  }
  return sharp;
}

// Update compressImage and other functions to use getSharp()
```

### Step 4: Update Build Process

Modify `justfile`:

```just
build:
  # Embed frontend assets
  bun run scripts/embed-assets.ts

  # Embed sharp bindings for each platform
  SHARP_PLATFORM=darwin-arm64 bun run scripts/embed-sharp-bindings.ts
  # Note: goreleaser will need to run this per-target

  GORELEASER_CURRENT_TAG=v{{current_version}} goreleaser build --clean --snapshot
  rm -f .*.bun-build
```

Modify `.goreleaser.yaml` to run embed script per platform:

```yaml
builds:
  - id: "blossom"
    builder: bun
    binary: blossom
    hooks:
      pre:
        - cmd: bun run scripts/embed-sharp-bindings.ts
          env:
            - SHARP_PLATFORM={{ if eq .Arch "arm64" }}{{ .Os }}-arm64{{ else }}{{ .Os }}-x64{{ end }}
    targets:
      - linux-x64-modern
      - linux-arm64
      - darwin-arm64
      - darwin-x64
    # ... rest of config
```

### Step 5: Entry Point Initialization

Add to `src/index.ts` at the very top (before any sharp imports):

```typescript
import { ensureSharpBindings } from "./lib/sharp-loader";

// Extract sharp bindings before anything else
await ensureSharpBindings();

// ... rest of imports
```

## File Changes Summary

| File | Action |
|------|--------|
| `scripts/embed-sharp-bindings.ts` | Create |
| `src/lib/sharp-loader.ts` | Create |
| `src/lib/image-compression.ts` | Modify (async sharp loading) |
| `src/index.ts` | Modify (add ensureSharpBindings call) |
| `src/generated/sharp-bindings.ts` | Generated at build time |
| `justfile` | Modify |
| `.goreleaser.yaml` | Modify |

## Considerations

### Binary Size
- Each platform binary grows by ~15MB
- Total build artifacts grow by ~60MB (4 platforms)

### First Run
- ~15MB extracted to `~/.blossom/native/` on first launch
- Subsequent launches skip extraction (files already exist)

### Version Upgrades
- Consider adding version check to re-extract when app version changes
- Or use content hash in filename

### Fallback Behavior
- If extraction fails, image compression is disabled
- App still functions, but large images may fail at API

### Linux Considerations
- Linux uses `.so` instead of `.dylib`
- May need to handle glibc vs musl variants
- Consider only supporting glibc initially

## Alternatives Considered

1. **WASM (wasm-vips)**: ~25x slower, but simpler bundling
2. **Client-side compression**: Moves work to frontend, different architecture
3. **Skip compression**: Simplest, but large images fail
4. **Ship bindings separately**: Breaks single-binary goal

## Testing

1. Build for darwin-arm64: `just build`
2. Copy binary to clean machine (no node_modules)
3. Run binary
4. Upload image >2MB in chat
5. Verify compression occurs (check `~/.blossom/native/` exists)
