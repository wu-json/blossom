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

**Use Bun's native file embedding:**
1. Import native bindings with `import ... with { type: "file" }` - embeds raw binary in executable
2. Files live in `$bunfs` virtual filesystem (not JS heap - no memory bloat)
3. Extract at runtime to `~/.blossom/native/` on first launch
4. Load native module with absolute path `require()`
5. Use npm sharp in dev mode, extracted native in compiled mode

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

### Step 1: Create Platform-Specific Embedding Modules

For each platform, create a file that imports the native bindings. These are only imported during build for that platform.

Create `src/native/darwin-arm64.ts`:

```typescript
// Bun embeds these files in the compiled binary via $bunfs
// @ts-ignore
import sharpNodePath from "../../node_modules/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node" with { type: "file" };
// @ts-ignore
import libvipsPath from "../../node_modules/@img/sharp-libvips-darwin-arm64/lib/libvips-cpp.8.17.3.dylib" with { type: "file" };

export const PLATFORM = "darwin-arm64";
export const SHARP_NODE_PATH = sharpNodePath;
export const LIBVIPS_PATH = libvipsPath;
export const SHARP_NODE_FILENAME = "sharp-darwin-arm64.node";
export const LIBVIPS_FILENAME = "libvips-cpp.8.17.3.dylib";
```

Similarly for `darwin-x64.ts`, `linux-x64.ts`, `linux-arm64.ts`.

Create `src/native/index.ts` (selects correct platform at build time):

```typescript
// This file is generated or conditionally imports based on build target
// For now, use environment variable set by goreleaser
const platform = process.env.SHARP_PLATFORM || "darwin-arm64";

export async function getNativeBindings() {
  switch (platform) {
    case "darwin-arm64":
      return import("./darwin-arm64");
    case "darwin-x64":
      return import("./darwin-x64");
    case "linux-x64":
      return import("./linux-x64");
    case "linux-arm64":
      return import("./linux-arm64");
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

### Step 2: Runtime Extraction & Native Wrapper

Create `src/lib/sharp-native.ts`:

```typescript
/**
 * Extracts embedded sharp bindings and loads native module.
 * Used in compiled binary mode where npm's sharp can't load.
 */
import { join } from "node:path";
import { mkdir, chmod } from "node:fs/promises";

let nativeModule: any = null;
let extractedPath: string | null = null;

// Detect if running as compiled binary
export const isCompiled = (() => {
  return process.execPath.includes("$bunfs") ||
         process.execPath.endsWith("/blossom");
})();

export async function ensureExtracted(): Promise<string | null> {
  if (!isCompiled) return null;
  if (extractedPath) return extractedPath;

  try {
    // Import platform-specific bindings (embedded via $bunfs)
    const bindings = await import("../native");
    const { PLATFORM, SHARP_NODE_PATH, LIBVIPS_PATH, SHARP_NODE_FILENAME, LIBVIPS_FILENAME } =
      await bindings.getNativeBindings();

    const blossomDir = process.env.BLOSSOM_DATA_DIR || join(process.env.HOME!, ".blossom");
    const nativeDir = join(blossomDir, "native", "@img");

    const sharpDir = join(nativeDir, `sharp-${PLATFORM}`, "lib");
    const libvipsDir = join(nativeDir, `sharp-libvips-${PLATFORM}`, "lib");

    await mkdir(sharpDir, { recursive: true });
    await mkdir(libvipsDir, { recursive: true });

    // Extract .node file from $bunfs to real filesystem
    const nodeFilePath = join(sharpDir, SHARP_NODE_FILENAME);
    if (!(await Bun.file(nodeFilePath).exists())) {
      const data = await Bun.file(SHARP_NODE_PATH).arrayBuffer();
      await Bun.write(nodeFilePath, data);
      await chmod(nodeFilePath, 0o755);
    }

    // Extract libvips from $bunfs
    const libvipsFilePath = join(libvipsDir, LIBVIPS_FILENAME);
    if (!(await Bun.file(libvipsFilePath).exists())) {
      const data = await Bun.file(LIBVIPS_PATH).arrayBuffer();
      await Bun.write(libvipsFilePath, data);
      await chmod(libvipsFilePath, 0o755);
    }

    extractedPath = nodeFilePath;
    return nodeFilePath;
  } catch (err) {
    console.warn("Failed to extract sharp bindings:", err);
    return null;
  }
}

function getNative() {
  if (nativeModule) return nativeModule;
  if (!extractedPath) throw new Error("Sharp bindings not extracted");
  nativeModule = require(extractedPath);
  return nativeModule;
}

// Minimal API matching what image-compression.ts needs
export async function getMetadata(buffer: Buffer): Promise<{ width: number; height: number }> {
  const native = getNative();
  return new Promise((resolve, reject) => {
    native.metadata({ input: buffer }, (err: Error, result: any) => {
      if (err) reject(err);
      else resolve({ width: result.width, height: result.height });
    });
  });
}

export async function processImage(
  buffer: Buffer,
  options: {
    width?: number;
    format: "jpeg" | "png" | "webp";
    quality?: number;
  }
): Promise<Buffer> {
  const native = getNative();
  return new Promise((resolve, reject) => {
    native.pipeline({
      input: buffer,
      formatOut: options.format,
      width: options.width || -1,
      height: -1,
      withoutEnlargement: true,
      jpegQuality: options.quality || 80,
      webpQuality: options.quality || 80,
    }, (err: Error, data: Buffer) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
```

### Step 3: Modify Image Compression

Update `src/lib/image-compression.ts` to use the appropriate backend:

```typescript
import { isCompiled, ensureExtracted, getMetadata, processImage } from "./sharp-native";

// For dev mode, dynamically import sharp
let sharpModule: typeof import("sharp") | null = null;

async function getSharp() {
  if (isCompiled) return null; // Use native wrapper instead
  if (sharpModule) return sharpModule;
  sharpModule = (await import("sharp")).default;
  return sharpModule;
}

// Initialize - call at startup
export async function initImageCompression() {
  if (isCompiled) {
    await ensureExtracted();
  }
}

// Example usage in compressImage():
async function compressImage(buffer: Buffer, ...): Promise<Buffer> {
  const sharp = await getSharp();

  if (sharp) {
    // Dev mode: use npm sharp with its nice fluent API
    return sharp(buffer).resize(width).jpeg({ quality }).toBuffer();
  } else {
    // Compiled mode: use native wrapper
    return processImage(buffer, { width, format: "jpeg", quality });
  }
}
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

Add to `src/index.ts` at the very top:

```typescript
import { initImageCompression } from "./lib/image-compression";

// Initialize image compression (extracts native bindings if compiled)
await initImageCompression();

// ... rest of imports
```

## File Changes Summary

| File | Action |
|------|--------|
| `src/native/darwin-arm64.ts` | Create (embeds darwin-arm64 bindings) |
| `src/native/darwin-x64.ts` | Create (embeds darwin-x64 bindings) |
| `src/native/linux-x64.ts` | Create (embeds linux-x64 bindings) |
| `src/native/linux-arm64.ts` | Create (embeds linux-arm64 bindings) |
| `src/native/index.ts` | Create (platform selector) |
| `src/lib/sharp-native.ts` | Create (extraction + native wrapper) |
| `src/lib/image-compression.ts` | Modify (use wrapper in compiled mode) |
| `src/index.ts` | Modify (add initImageCompression call) |
| `.goreleaser.yaml` | Modify (set SHARP_PLATFORM env var) |

## Key Technical Findings

1. **Bun's `import ... with { type: "file" }` works**: Embeds raw binary in executable, accessible via `$bunfs`
2. **No memory bloat**: Files live in `$bunfs` virtual filesystem, not JS heap (unlike base64 strings)
3. **Absolute path require works**: `require("/path/to/sharp.node")` works in compiled binaries
4. **rpath resolution works**: When the `.node` and `.dylib` are in the right relative positions, libvips loads correctly
5. **NODE_PATH doesn't work**: Scoped packages (`@img/...`) can't be resolved via NODE_PATH in Bun
6. **require.cache injection doesn't work in compiled binaries**: The cache keys differ between dev and compiled modes

## Open Questions / Risks

1. **Native API stability**: The native module's options format may change between sharp versions
2. **Platform detection**: Need reliable way to detect platform at build time for goreleaser
3. **Cross-compilation**: Building on macOS for Linux may not have Linux bindings available
4. **Error handling**: Native module errors may be cryptic; need good fallback messaging

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
