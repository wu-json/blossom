import { mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { blossomDir } from "../db/database";

const VERSIONS = {
  sharp: "0.34.5",
  libvips: "1.1.0",
} as const;

// libvips dynamic library filename varies by platform
const LIBVIPS_FILENAMES: Record<string, string> = {
  "darwin-arm64": "libvips-cpp.8.16.1.dylib",
  "darwin-x64": "libvips-cpp.8.16.1.dylib",
  "linux-arm64": "libvips-cpp.so.8.16.1",
  "linux-x64": "libvips-cpp.so.8.16.1",
};

interface VersionManifest {
  sharp: string;
  libvips: string;
}

function getPlatformKey(): string {
  const platform = process.platform;
  const arch = process.arch === "arm64" ? "arm64" : "x64";

  if (platform === "darwin" && (arch === "arm64" || arch === "x64")) {
    return `darwin-${arch}`;
  }
  if (platform === "linux" && (arch === "arm64" || arch === "x64")) {
    return `linux-${arch}`;
  }

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

export async function ensureSharpBindings(): Promise<void> {
  const platformKey = getPlatformKey();
  const nativeDir = join(blossomDir, "native");
  const manifestPath = join(nativeDir, "versions.json");

  const sharpPkg = `sharp-${platformKey}`;
  const libvipsPkg = `sharp-libvips-${platformKey}`;

  const sharpDir = join(nativeDir, "@img", sharpPkg, "lib");
  const libvipsDir = join(nativeDir, "@img", libvipsPkg, "lib");

  const sharpNodeFile = join(sharpDir, `${sharpPkg}.node`);
  const libvipsFile = join(libvipsDir, LIBVIPS_FILENAMES[platformKey]!);

  // Check if we need to download/update
  let needsDownload = false;
  try {
    const manifest: VersionManifest = JSON.parse(await Bun.file(manifestPath).text());
    if (manifest.sharp !== VERSIONS.sharp || manifest.libvips !== VERSIONS.libvips) {
      needsDownload = true;
    }
    // Also check if files exist
    const sharpExists = await Bun.file(sharpNodeFile).exists();
    const libvipsExists = await Bun.file(libvipsFile).exists();
    if (!sharpExists || !libvipsExists) {
      needsDownload = true;
    }
  } catch {
    needsDownload = true;
  }

  if (!needsDownload) {
    return;
  }


  await mkdir(sharpDir, { recursive: true });
  await mkdir(libvipsDir, { recursive: true });

  // npm registry tarball URLs
  const sharpUrl = `https://registry.npmjs.org/@img/${sharpPkg}/-/${sharpPkg}-${VERSIONS.sharp}.tgz`;
  const libvipsUrl = `https://registry.npmjs.org/@img/${libvipsPkg}/-/${libvipsPkg}-${VERSIONS.libvips}.tgz`;

  // Download and extract sharp .node file
  await downloadAndExtract(
    sharpUrl,
    `package/lib/${sharpPkg}.node`,
    sharpNodeFile
  );

  // Download and extract libvips
  await downloadAndExtract(
    libvipsUrl,
    `package/lib/${LIBVIPS_FILENAMES[platformKey]}`,
    libvipsFile
  );

  // Write version manifest
  await Bun.write(manifestPath, JSON.stringify(VERSIONS));
}

async function downloadAndExtract(
  url: string,
  tarballPath: string,
  destPath: string
): Promise<void> {
  const tempTar = `${destPath}.tgz`;

  // Download tarball using curl
  const curlProc = Bun.spawn(["curl", "-fsSL", "-o", tempTar, url], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const curlExit = await curlProc.exited;
  if (curlExit !== 0) {
    const stderr = await new Response(curlProc.stderr).text();
    throw new Error(`Failed to download ${url}: ${stderr || `exit code ${curlExit}`}`);
  }

  // Extract specific file from tarball
  // tar -xzf file.tgz -O path/in/tar > destPath
  const tarProc = Bun.spawn(
    ["tar", "-xzf", tempTar, "-O", tarballPath],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const fileData = await new Response(tarProc.stdout).arrayBuffer();
  const tarExit = await tarProc.exited;

  // Clean up temp file
  try {
    await Bun.file(tempTar).exists() && await Bun.write(tempTar, ""); // truncate
    const { unlink } = await import("node:fs/promises");
    await unlink(tempTar);
  } catch {}

  if (tarExit !== 0 || fileData.byteLength === 0) {
    const stderr = await new Response(tarProc.stderr).text();
    throw new Error(`Failed to extract ${tarballPath}: ${stderr || "empty file"}`);
  }

  // Write extracted file
  await Bun.write(destPath, fileData);
  await chmod(destPath, 0o755);

  // On macOS, ad-hoc sign native binaries to allow loading from a signed app
  // (removes original Team ID while keeping a valid signature)
  if (process.platform === "darwin" && destPath.endsWith(".node")) {
    const codesignProc = Bun.spawn(["codesign", "--force", "--sign", "-", destPath], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await codesignProc.exited;
  }
}
