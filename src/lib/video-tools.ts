import { mkdir, chmod, unlink } from "node:fs/promises";
import { join } from "node:path";
import { blossomDir } from "../db/database";

const TOOL_VERSIONS = {
  ytdlp: "2024.12.13",
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

export async function extractFrame(videoId: string, timestampSeconds: number): Promise<Buffer> {
  const { ytdlp, ffmpeg } = await ensureVideoTools();
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Get direct stream URL (yt-dlp resolves YouTube's signed URLs)
  const streamUrlProc = Bun.spawn([ytdlp, "-g", "-f", "best[height<=720]", videoUrl], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const streamUrlOutput = await new Response(streamUrlProc.stdout).text();
  const streamUrl = streamUrlOutput.trim();
  const exitCode = await streamUrlProc.exited;

  if (exitCode !== 0 || !streamUrl) {
    const stderr = await new Response(streamUrlProc.stderr).text();
    throw new Error(`Failed to get video stream URL: ${stderr || "Unknown error"}`);
  }

  // Extract single frame at timestamp
  const ffmpegProc = Bun.spawn(
    [
      ffmpeg,
      "-ss",
      String(timestampSeconds), // Seek to timestamp
      "-i",
      streamUrl, // Input stream
      "-frames:v",
      "1", // Extract 1 frame
      "-f",
      "image2pipe", // Output to stdout
      "-vcodec",
      "png", // PNG format
      "-", // Output to stdout
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
    throw new Error(`Failed to extract frame: ${stderr || "Unknown error"}`);
  }

  return Buffer.from(frameBuffer);
}
