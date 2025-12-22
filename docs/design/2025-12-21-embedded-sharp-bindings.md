# Embedded Sharp Native Bindings

## Problem

Sharp is used for image compression before sending images to the Anthropic API (`src/lib/image-compression.ts`). When building Blossom as a single binary with `bun build --compile`, sharp fails to load because:

1. Native `.node` files cannot be embedded in the binary
2. The `.node` file depends on `libvips-cpp.dylib` which must exist on disk
3. The OS dynamic linker (`dlopen`) requires real filesystem paths

## Investigation Summary

### What is `dlopen`?

Native Node modules (`.node` files) are shared libraries loaded via the operating system's `dlopen()` function. This function:
- Requires a **real file path on disk** - cannot load from memory or virtual filesystems
- Maps the binary into process memory
- Resolves symbol references (libvips, libc, etc.)

This is why we must **extract** native bindings to disk before loading - `dlopen` cannot read from Bun's `$bunfs` virtual filesystem.

### Approaches Tested

| Approach | Result |
|----------|--------|
| `Bun.plugin` (onResolve/onLoad) | Intercepts but `.node` uses `dlopen`, bypasses plugins |
| `NODE_PATH` + symlinks | Works in dev, fails in compiled binary |
| `require.cache` injection | Bundled code uses different cache keys |
| Runtime `node_modules` symlinks | Sharp's JS dependencies not available |
| **Patch sharp's loader** | **Works!** |

### Key Findings

1. **`import ... with { type: "file" }` works**: Embeds raw binary in executable via `$bunfs` (no base64, no memory bloat)
2. **Absolute path `require()` works**: `require("/path/to/sharp.node")` loads native modules in compiled binaries
3. **rpath resolution works**: When `.node` and `.dylib` are in correct relative positions, libvips loads
4. **Sharp's loader is simple**: Just an array of paths to try - easy to patch

## Solution

**Patch sharp's loader + embed/extract native bindings:**

1. Use `patch-package` to modify sharp's loader to check our extraction path first
2. Embed native bindings with `import ... with { type: "file" }`
3. Extract to `~/.blossom/native/` on first launch
4. Sharp's full JS API works normally - no custom wrapper needed!

## Architecture

### Files to Embed (per platform)

| Platform | .node file | libvips | Total |
|----------|-----------|---------|-------|
| darwin-arm64 | 256KB | 15MB | ~15MB |
| darwin-x64 | 256KB | 15MB | ~15MB |
| linux-x64 | 256KB | 15MB | ~15MB |
| linux-arm64 | 256KB | 15MB | ~15MB |

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

### Step 1: Patch Sharp's Loader

Bun has built-in support for patching packages via `bun patch`.

**Prepare the package for patching:**
```bash
bun patch sharp
```

This creates an unlinked clone in `node_modules/` that's safe to edit.

**Modify `node_modules/sharp/lib/sharp.js`:**

```javascript
// Before:
const paths = [
  `../src/build/Release/sharp-${runtimePlatform}.node`,
  '../src/build/Release/sharp-wasm32.node',
  `@img/sharp-${runtimePlatform}/sharp.node`,
  '@img/sharp-wasm32/sharp.node'
];

// After:
const paths = [
  // Blossom: check extracted native bindings first (for compiled binary)
  `${process.env.HOME || ''}/.blossom/native/@img/sharp-${runtimePlatform}/lib/sharp-${runtimePlatform}.node`,
  // Original paths
  `../src/build/Release/sharp-${runtimePlatform}.node`,
  '../src/build/Release/sharp-wasm32.node',
  `@img/sharp-${runtimePlatform}/sharp.node`,
  '@img/sharp-wasm32/sharp.node'
];
```

**Commit the patch:**
```bash
bun patch --commit sharp
```

This will:
1. Generate a `.patch` file in `patches/sharp@0.34.5.patch`
2. Add `"patchedDependencies"` to `package.json`
3. Automatically apply the patch on future `bun install` runs

No postinstall script needed - Bun applies patches automatically during install.

### Step 2: Create Native Embedding Module

Create `src/native/sharp-bindings.ts`:

```typescript
import { join } from "node:path";
import { mkdir, chmod } from "node:fs/promises";

// Embed native files - Bun stores these in $bunfs, not JS heap
// @ts-ignore
import sharpNodePath from "../../node_modules/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node" with { type: "file" };
// @ts-ignore
import libvipsPath from "../../node_modules/@img/sharp-libvips-darwin-arm64/lib/libvips-cpp.8.17.3.dylib" with { type: "file" };

export const PLATFORM = "darwin-arm64";
export const SHARP_NODE_EMBEDDED = sharpNodePath;
export const LIBVIPS_EMBEDDED = libvipsPath;

export async function extractSharpBindings(): Promise<void> {
  const blossomDir = process.env.BLOSSOM_DATA_DIR || join(process.env.HOME!, ".blossom");
  const nativeDir = join(blossomDir, "native", "@img");

  const sharpDir = join(nativeDir, `sharp-${PLATFORM}`, "lib");
  const libvipsDir = join(nativeDir, `sharp-libvips-${PLATFORM}`, "lib");

  await mkdir(sharpDir, { recursive: true });
  await mkdir(libvipsDir, { recursive: true });

  // Extract .node file from $bunfs to real filesystem
  const sharpDest = join(sharpDir, `sharp-${PLATFORM}.node`);
  if (!(await Bun.file(sharpDest).exists())) {
    const data = await Bun.file(SHARP_NODE_EMBEDDED).arrayBuffer();
    await Bun.write(sharpDest, data);
    await chmod(sharpDest, 0o755);
  }

  // Extract libvips
  const libvipsDest = join(libvipsDir, "libvips-cpp.8.17.3.dylib");
  if (!(await Bun.file(libvipsDest).exists())) {
    const data = await Bun.file(LIBVIPS_EMBEDDED).arrayBuffer();
    await Bun.write(libvipsDest, data);
    await chmod(libvipsDest, 0o755);
  }
}
```

Create platform-specific variants: `darwin-x64.ts`, `linux-x64.ts`, `linux-arm64.ts`.

### Step 3: Extract on Startup

Add to `src/index.ts` before importing sharp:

```typescript
// Extract sharp native bindings if running as compiled binary
const isCompiled = process.execPath.includes("$bunfs") || process.execPath.endsWith("/blossom");
if (isCompiled) {
  const { extractSharpBindings } = await import("./native/sharp-bindings");
  await extractSharpBindings();
}

// Now sharp can be imported normally - patched loader will find extracted bindings
import sharp from "sharp";
```

### Step 4: Update Build Process

Modify `.goreleaser.yaml` to set platform for correct embedding:

```yaml
builds:
  - id: "blossom"
    builder: bun
    binary: blossom
    env:
      - SHARP_PLATFORM={{ if eq .Arch "arm64" }}{{ .Os }}-arm64{{ else }}{{ .Os }}-x64{{ end }}
    targets:
      - linux-x64-modern
      - linux-arm64
      - darwin-arm64
      - darwin-x64
```

## File Changes Summary

| File | Action |
|------|--------|
| `patches/sharp@0.34.5.patch` | Create (via `bun patch --commit`) |
| `src/native/darwin-arm64.ts` | Create |
| `src/native/darwin-x64.ts` | Create |
| `src/native/linux-x64.ts` | Create |
| `src/native/linux-arm64.ts` | Create |
| `src/index.ts` | Modify (add extraction on startup) |
| `package.json` | Auto-modified (adds `patchedDependencies`) |

## Why This Works

1. **Sharp's loader is patched** to check `~/.blossom/native/` first
2. **Native bindings are embedded** via Bun's `type: "file"` import (stored in `$bunfs`, not JS heap)
3. **On first run**, bindings are extracted to disk where `dlopen` can load them
4. **Sharp's full JS API works** - no custom wrapper needed

## Advantages Over Custom Wrapper

- Use sharp's complete, tested API
- No need to understand native module's complex options format
- Automatic compatibility with sharp updates (unless loader changes)
- Less code to maintain

## Considerations

### Binary Size
- Each platform binary grows by ~15MB
- Total build artifacts grow by ~60MB (4 platforms)

### First Run
- ~15MB extracted to `~/.blossom/native/` on first launch
- Subsequent launches skip extraction (files already exist)

### Version Upgrades
- Consider adding version check to re-extract when app version changes
- Or include version in extraction path: `~/.blossom/native/v0.0.5/@img/...`

### Linux Considerations
- Linux uses `.so` instead of `.dylib`
- Filename pattern: `libvips-cpp.so.8.17.3`
- May need to handle glibc vs musl variants

## Testing

1. Create patch: `bun patch sharp`, edit file, `bun patch --commit sharp`
2. Verify patch applies: `bun install` (should apply patch automatically)
3. Build: `just build`
4. Copy binary to clean machine (no node_modules)
5. Run binary
6. Upload image >2MB in chat
7. Verify:
   - `~/.blossom/native/@img/` contains extracted files
   - Image is compressed successfully
