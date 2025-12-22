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

### Step 2: Runtime Extraction & Native Wrapper

Create `src/lib/sharp-native.ts`:

```typescript
/**
 * Minimal sharp wrapper that loads native module directly.
 * Used in compiled binary mode where npm's sharp can't load.
 */
import { join } from "node:path";
import { mkdir, chmod } from "node:fs/promises";

let nativeModule: any = null;
let extractionDone = false;

// Detect if running as compiled binary
const isCompiled = (() => {
  // Compiled binaries run from /$bunfs/...
  return process.execPath.includes("$bunfs") ||
         process.execPath.endsWith("/blossom");
})();

async function ensureExtracted(): Promise<string | null> {
  if (!isCompiled) return null; // Use npm sharp in dev
  if (extractionDone) {
    const blossomDir = process.env.BLOSSOM_DATA_DIR || join(process.env.HOME!, ".blossom");
    return join(blossomDir, "native/@img/sharp-PLATFORM/lib/sharp-PLATFORM.node");
  }

  try {
    const bindings = await import("../generated/sharp-bindings");
    const blossomDir = process.env.BLOSSOM_DATA_DIR || join(process.env.HOME!, ".blossom");
    const nativeDir = join(blossomDir, "native", "@img");

    const sharpDir = join(nativeDir, `sharp-${bindings.SHARP_PLATFORM}`, "lib");
    const libvipsDir = join(nativeDir, `sharp-libvips-${bindings.SHARP_PLATFORM}`, "lib");

    await mkdir(sharpDir, { recursive: true });
    await mkdir(libvipsDir, { recursive: true });

    // Extract .node file
    const nodeFilePath = join(sharpDir, bindings.SHARP_NODE_FILENAME);
    if (!(await Bun.file(nodeFilePath).exists())) {
      await Bun.write(nodeFilePath, Buffer.from(bindings.SHARP_NODE_BASE64, "base64"));
      await chmod(nodeFilePath, 0o755);
    }

    // Extract libvips
    const libvipsFilePath = join(libvipsDir, bindings.LIBVIPS_FILENAME);
    if (!(await Bun.file(libvipsFilePath).exists())) {
      await Bun.write(libvipsFilePath, Buffer.from(bindings.LIBVIPS_BASE64, "base64"));
      await chmod(libvipsFilePath, 0o755);
    }

    extractionDone = true;
    return nodeFilePath;
  } catch (err) {
    console.warn("Failed to extract sharp bindings:", err);
    return null;
  }
}

function getNative() {
  if (nativeModule) return nativeModule;
  // Path set by ensureExtracted or pre-known
  const blossomDir = process.env.BLOSSOM_DATA_DIR || join(process.env.HOME!, ".blossom");
  // Platform detected at build time
  const platform = process.env.SHARP_PLATFORM || "darwin-arm64"; // fallback
  const nodePath = join(blossomDir, `native/@img/sharp-${platform}/lib/sharp-${platform}.node`);
  nativeModule = require(nodePath);
  return nativeModule;
}

// Minimal API matching what image-compression.ts needs
export async function getMetadata(buffer: Buffer): Promise<{ width: number; height: number }> {
  const native = getNative();
  return new Promise((resolve, reject) => {
    // Sharp native expects specific options structure
    const options = {
      input: buffer,
      limitInputPixels: 268402689,
      sequentialRead: true,
    };
    native.metadata(options, (err: Error, result: any) => {
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
    compressionLevel?: number;
  }
): Promise<Buffer> {
  const native = getNative();
  return new Promise((resolve, reject) => {
    const pipelineOpts: any = {
      input: buffer,
      limitInputPixels: 268402689,
      sequentialRead: true,
      // Output format
      formatOut: options.format,
      // Resize
      width: options.width || -1,
      height: -1,
      canvas: "crop",
      withoutEnlargement: true,
      // Format-specific
      jpegQuality: options.quality || 80,
      pngCompressionLevel: options.compressionLevel || 6,
      webpQuality: options.quality || 80,
    };
    native.pipeline(pipelineOpts, (err: Error, data: Buffer, info: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

export { ensureExtracted, isCompiled };
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
| `scripts/embed-sharp-bindings.ts` | Create |
| `src/lib/sharp-native.ts` | Create (minimal native wrapper) |
| `src/lib/image-compression.ts` | Modify (use wrapper in compiled mode) |
| `src/index.ts` | Modify (add initImageCompression call) |
| `src/generated/sharp-bindings.ts` | Generated at build time |
| `justfile` | Modify |
| `.goreleaser.yaml` | Modify |

## Key Technical Findings

1. **Absolute path require works**: `require("/path/to/sharp.node")` works in compiled binaries
2. **rpath resolution works**: When the `.node` and `.dylib` are in the right relative positions, libvips loads correctly
3. **NODE_PATH doesn't work**: Scoped packages (`@img/...`) can't be resolved via NODE_PATH in Bun
4. **require.cache injection doesn't work in compiled binaries**: The cache keys differ between dev and compiled modes
5. **Native API is complex**: Sharp's native module expects a large options object with many default values

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
