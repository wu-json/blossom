import { join } from "node:path";
import { mkdir, chmod } from "node:fs/promises";

// Embed native files - Bun stores these in $bunfs, not JS heap
// @ts-ignore - Bun-specific import with type: "file"
import sharpNodePath from "../../node_modules/@img/sharp-darwin-x64/lib/sharp-darwin-x64.node" with { type: "file" };
// @ts-ignore - Bun-specific import with type: "file"
import libvipsPath from "../../node_modules/@img/sharp-libvips-darwin-x64/lib/libvips-cpp.8.17.3.dylib" with { type: "file" };

export const PLATFORM = "darwin-x64";
export const SHARP_NODE_EMBEDDED = sharpNodePath;
export const LIBVIPS_EMBEDDED = libvipsPath;
export const LIBVIPS_FILENAME = "libvips-cpp.8.17.3.dylib";

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
  const libvipsDest = join(libvipsDir, LIBVIPS_FILENAME);
  if (!(await Bun.file(libvipsDest).exists())) {
    const data = await Bun.file(LIBVIPS_EMBEDDED).arrayBuffer();
    await Bun.write(libvipsDest, data);
    await chmod(libvipsDest, 0o755);
  }
}
