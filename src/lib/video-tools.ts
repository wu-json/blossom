import { mkdir, chmod, unlink } from "node:fs/promises";
import { join } from "node:path";
import { blossomDir } from "../db/database";

const TOOL_VERSIONS = {
  ytdlp: "2025.12.08",
  ffmpeg: "6.1.1",
} as const;

const DOWNLOAD_URLS: Record<string, Record<string, { ytdlp: string; ffmpeg: string }>> = {
  darwin: {
    arm64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp_macos`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/ffmpeg-darwin-arm64.gz`,
    },
    x64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp_macos`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/ffmpeg-darwin-x64.gz`,
    },
  },
  linux: {
    x64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp_linux`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/ffmpeg-linux-x64.gz`,
    },
  },
  win32: {
    x64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp.exe`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/ffmpeg-win32-x64.gz`,
    },
  },
};

export interface ToolPaths {
  ytdlp: string;
  ffmpeg: string;
}

interface VersionManifest {
  ytdlp: string;
  ffmpeg: string;
}

export async function ensureVideoTools(): Promise<ToolPaths> {
  const binDir = join(blossomDir, "bin");
  const manifestPath = join(binDir, "versions.json");

  const ytdlpPath = join(binDir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  const ffmpegPath = join(binDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

  // Check if we need to download/update
  let needsDownload = false;
  try {
    const manifest: VersionManifest = JSON.parse(await Bun.file(manifestPath).text());
    if (manifest.ytdlp !== TOOL_VERSIONS.ytdlp || manifest.ffmpeg !== TOOL_VERSIONS.ffmpeg) {
      needsDownload = true;
    }
    // Also check if binaries exist
    const ytdlpExists = await Bun.file(ytdlpPath).exists();
    const ffmpegExists = await Bun.file(ffmpegPath).exists();
    if (!ytdlpExists || !ffmpegExists) {
      needsDownload = true;
    }
  } catch {
    needsDownload = true;
  }

  if (needsDownload) {
    await mkdir(binDir, { recursive: true });

    const platform = process.platform;
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const urls = DOWNLOAD_URLS[platform]?.[arch];

    if (!urls) {
      throw new Error(`Unsupported platform: ${platform}-${arch}`);
    }

    console.log("Downloading video tools...");

    // Download yt-dlp using curl for reliable redirect handling
    console.log("  yt-dlp...");
    const ytdlpProc = Bun.spawn(["curl", "-fsSL", "-o", ytdlpPath, urls.ytdlp], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const ytdlpExit = await ytdlpProc.exited;
    if (ytdlpExit !== 0) {
      throw new Error(`Failed to download yt-dlp (exit code ${ytdlpExit})`);
    }
    await chmod(ytdlpPath, 0o755);

    // Download ffmpeg using curl and decompress
    console.log("  ffmpeg...");
    const ffmpegGzPath = `${ffmpegPath}.gz`;
    const ffmpegProc = Bun.spawn(["curl", "-fsSL", "-o", ffmpegGzPath, urls.ffmpeg], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const ffmpegExit = await ffmpegProc.exited;
    if (ffmpegExit !== 0) {
      throw new Error(`Failed to download ffmpeg (exit code ${ffmpegExit})`);
    }

    // Decompress ffmpeg
    const ffmpegGz = await Bun.file(ffmpegGzPath).arrayBuffer();
    const ffmpegBinary = Bun.gunzipSync(new Uint8Array(ffmpegGz));
    await Bun.write(ffmpegPath, ffmpegBinary);
    await chmod(ffmpegPath, 0o755);
    await unlink(ffmpegGzPath);

    // Write version manifest
    await Bun.write(manifestPath, JSON.stringify(TOOL_VERSIONS));

    console.log("  Done\n");
  }

  return { ytdlp: ytdlpPath, ffmpeg: ffmpegPath };
}

// Cache stream URLs to avoid repeated yt-dlp calls (URLs are valid for hours)
const streamUrlCache = new Map<string, { url: string; expires: number }>();
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

// Frames directory
export const framesDir = join(blossomDir, "frames");

async function getStreamUrl(videoId: string, ytdlp: string, highQuality: boolean = false): Promise<string> {
  const cacheKey = `${videoId}-${highQuality ? "hq" : "lq"}`;
  const cached = streamUrlCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // High quality: best video stream (up to 1080p), Low quality: capped at 720p for API
  const format = highQuality
    ? "bestvideo[height<=1080]/bestvideo/best"
    : "best[height<=720]/best";

  const streamUrlProc = Bun.spawn([
    ytdlp,
    "-g",
    "-f", format,
    "--no-warnings",
    videoUrl
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const streamUrlOutput = await new Response(streamUrlProc.stdout).text();
  const stderr = await new Response(streamUrlProc.stderr).text();
  const exitCode = await streamUrlProc.exited;

  const streamUrl = streamUrlOutput.trim().split("\n")[0];

  if (exitCode !== 0 || !streamUrl) {
    throw new Error(`Failed to get video stream URL: ${stderr || "Unknown error"}`);
  }

  streamUrlCache.set(cacheKey, { url: streamUrl, expires: Date.now() + CACHE_TTL });
  return streamUrl;
}

interface ExtractOptions {
  format: "png" | "jpeg";
  jpegQuality?: number; // 1-31, lower is better
}

async function extractFrameWithUrl(
  ffmpeg: string,
  streamUrl: string,
  timestampSeconds: number,
  options: ExtractOptions = { format: "jpeg", jpegQuality: 2 }
): Promise<{ buffer: Buffer | null; error: string }> {
  const args = [
    ffmpeg,
    "-hide_banner",
    "-nostdin",
    "-ss",
    String(timestampSeconds),
    "-i",
    streamUrl,
    "-frames:v",
    "1",
    "-f",
    "image2pipe",
  ];

  if (options.format === "png") {
    args.push("-vcodec", "png");
  } else {
    args.push("-vcodec", "mjpeg", "-q:v", String(options.jpegQuality || 2));
  }

  args.push("-");

  const ffmpegProc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const frameBuffer = await new Response(ffmpegProc.stdout).arrayBuffer();
  const ffmpegExitCode = await ffmpegProc.exited;

  if (ffmpegExitCode !== 0 || frameBuffer.byteLength === 0) {
    const stderr = await new Response(ffmpegProc.stderr).text();
    return { buffer: null, error: stderr };
  }

  return { buffer: Buffer.from(frameBuffer), error: "" };
}

// Extract high-quality frame (PNG, up to 1080p) and save to disk, return the filename
export async function extractAndSaveFrame(videoId: string, timestampSeconds: number): Promise<string> {
  const { ytdlp, ffmpeg } = await ensureVideoTools();
  await mkdir(framesDir, { recursive: true });

  // Get high-quality stream URL (up to 1080p)
  let streamUrl = await getStreamUrl(videoId, ytdlp, true);
  let result = await extractFrameWithUrl(ffmpeg, streamUrl, timestampSeconds, { format: "png" });

  // If failed (possibly expired URL), clear cache and retry once
  if (!result.buffer && result.error.includes("403")) {
    streamUrlCache.delete(`${videoId}-hq`);
    streamUrl = await getStreamUrl(videoId, ytdlp, true);
    result = await extractFrameWithUrl(ffmpeg, streamUrl, timestampSeconds, { format: "png" });
  }

  if (!result.buffer) {
    throw new Error(`Failed to extract frame: ${result.error || "Unknown error"}`);
  }

  // Save to disk with unique filename
  const filename = `${videoId}-${Math.round(timestampSeconds * 1000)}-${Date.now()}.png`;
  const filepath = join(framesDir, filename);
  await Bun.write(filepath, result.buffer);

  return filename;
}

// Compress an image for API calls (resize to 720p max, lower quality)
export async function compressFrameForApi(filename: string): Promise<Buffer> {
  const { ffmpeg } = await ensureVideoTools();
  const filepath = join(framesDir, filename);

  const ffmpegProc = Bun.spawn(
    [
      ffmpeg,
      "-hide_banner",
      "-nostdin",
      "-i",
      filepath,
      "-vf",
      "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "-q:v",
      "8", // Lower quality for API (still good enough for OCR)
      "-",
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const frameBuffer = await new Response(ffmpegProc.stdout).arrayBuffer();
  const ffmpegExitCode = await ffmpegProc.exited;

  if (ffmpegExitCode !== 0 || frameBuffer.byteLength === 0) {
    const stderr = await new Response(ffmpegProc.stderr).text();
    throw new Error(`Failed to compress frame: ${stderr || "Unknown error"}`);
  }

  return Buffer.from(frameBuffer);
}

// Legacy function for backward compatibility
export async function extractFrame(videoId: string, timestampSeconds: number): Promise<Buffer> {
  const { ytdlp, ffmpeg } = await ensureVideoTools();

  let streamUrl = await getStreamUrl(videoId, ytdlp, false);
  let result = await extractFrameWithUrl(ffmpeg, streamUrl, timestampSeconds, { format: "jpeg", jpegQuality: 2 });

  if (!result.buffer && result.error.includes("403")) {
    streamUrlCache.delete(`${videoId}-lq`);
    streamUrl = await getStreamUrl(videoId, ytdlp, false);
    result = await extractFrameWithUrl(ffmpeg, streamUrl, timestampSeconds, { format: "jpeg", jpegQuality: 2 });
  }

  if (!result.buffer) {
    throw new Error(`Failed to extract frame: ${result.error || "Unknown error"}`);
  }

  return result.buffer;
}
