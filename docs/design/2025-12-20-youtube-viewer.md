# YouTube Viewer Feature

**Date:** 2025-12-20
**Status:** Draft

## Overview

The YouTube Viewer feature allows users to watch YouTube videos and generate word-by-word translations of any frame by pressing a button. This enables language learners to pause at any moment and get detailed breakdowns of text visible in the video (subtitles, signs, captions, etc.).

## User Flow

1. User navigates to the YouTube tab in the sidebar
2. User pastes a YouTube video URL into the input field
3. An embedded YouTube player loads the video
4. User watches/pauses the video using standard player controls
5. User clicks "Translate Frame" button
6. System captures the current frame as a screenshot
7. Screenshot is sent to Claude API for translation
8. Translation card appears with breakdown (same format as chat)

## Technical Design

### Sidebar Integration

Add new navigation item to `src/components/sidebar/sidebar.tsx`:

```typescript
const navItems = [
  { icon: MessageSquare, label: "chat", path: "/chat" },
  { icon: Youtube, label: "youtube", path: "/youtube" }, // New
  { icon: Flower2, label: "meadow", path: "/meadow" },
  { icon: GraduationCap, label: "teacher", path: "/teacher" },
  { icon: Settings, label: "settings", path: "/settings" },
];
```

Add translations to `src/lib/translations.ts`:

```typescript
youtube: {
  en: "YouTube",
  ja: "YouTube",
  zh: "YouTube",
  ko: "YouTube",
}
```

### Routing

Add route to `src/router.tsx`:

```typescript
<Route path="/youtube" component={YouTubeViewer} />
```

### View Type

Extend view type in `src/types/chat.ts`:

```typescript
type View = "chat" | "settings" | "teacher" | "meadow" | "youtube";
```

### Feature Structure

```
src/features/youtube/
├── youtube-viewer.tsx      # Main page component
├── youtube-player.tsx      # YouTube iframe wrapper
├── frame-capture.tsx       # Screenshot capture logic
└── translation-panel.tsx   # Translation result display
```

### YouTube Player Component

Use the YouTube IFrame Player API for programmatic control:

```typescript
interface YouTubePlayerProps {
  videoId: string;
  onReady: (player: YT.Player, videoData: YT.VideoData) => void;
}

function YouTubePlayer({ videoId, onReady }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load YouTube IFrame API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      const player = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            // Get video metadata including title
            const videoData = player.getVideoData();
            // videoData.title contains the video title
            // videoData.author contains the channel name
            onReady(player, videoData);
          },
        },
      });
    };
  }, [videoId]);

  return <div ref={containerRef} />;
}
```

The `getVideoData()` method returns video metadata which we store in `youtube_translations.video_title` for display when the video becomes unavailable.

### Frame Capture Strategy

We use server-side frame extraction with yt-dlp and ffmpeg. This provides clean video frames without any YouTube player UI overlay, controls, or browser chrome.

#### Why Server-Side Extraction?

- **Clean frames**: No player controls, progress bars, or UI elements
- **No user permission prompts**: Unlike Screen Capture API
- **Reliable cropping**: Exact video dimensions, no guesswork
- **Works in background**: User can pause video, frame is extracted server-side

#### Video Tools Setup

yt-dlp and ffmpeg binaries are downloaded on first use to `~/.blossom/bin/`. Versions are pinned for compatibility.

```typescript
// src/lib/video-tools.ts

const TOOL_VERSIONS = {
  ytdlp: "2024.12.13",
  ffmpeg: "7.1",
} as const;

const DOWNLOAD_URLS: Record<string, Record<string, { ytdlp: string; ffmpeg: string }>> = {
  darwin: {
    arm64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp_macos`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/darwin-arm64.gz`,
    },
    x64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp_macos`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/darwin-x64.gz`,
    },
  },
  linux: {
    x64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp_linux`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/linux-x64.gz`,
    },
  },
  win32: {
    x64: {
      ytdlp: `https://github.com/yt-dlp/yt-dlp/releases/download/${TOOL_VERSIONS.ytdlp}/yt-dlp.exe`,
      ffmpeg: `https://github.com/eugeneware/ffmpeg-static/releases/download/b${TOOL_VERSIONS.ffmpeg}/win32-x64.gz`,
    },
  },
};

interface ToolPaths {
  ytdlp: string;
  ffmpeg: string;
}

// ~/.blossom/bin/versions.json tracks installed versions
interface VersionManifest {
  ytdlp: string;
  ffmpeg: string;
}

async function ensureVideoTools(): Promise<ToolPaths> {
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

    // Download yt-dlp
    const ytdlpResponse = await fetch(urls.ytdlp);
    await Bun.write(ytdlpPath, ytdlpResponse);
    await chmod(ytdlpPath, 0o755);

    // Download and decompress ffmpeg (gzipped)
    const ffmpegResponse = await fetch(urls.ffmpeg);
    const ffmpegGz = await ffmpegResponse.arrayBuffer();
    const ffmpegBinary = Bun.gunzipSync(new Uint8Array(ffmpegGz));
    await Bun.write(ffmpegPath, ffmpegBinary);
    await chmod(ffmpegPath, 0o755);

    // Write version manifest
    await Bun.write(manifestPath, JSON.stringify(TOOL_VERSIONS));
  }

  return { ytdlp: ytdlpPath, ffmpeg: ffmpegPath };
}
```

#### Frame Extraction Flow

1. User clicks "Translate Frame" at current timestamp
2. Frontend sends `{ videoId, timestamp }` to server
3. Server extracts frame using yt-dlp + ffmpeg:

```typescript
// src/lib/frame-extraction.ts

async function extractFrame(videoId: string, timestampSeconds: number): Promise<Buffer> {
  const { ytdlp, ffmpeg } = await ensureVideoTools();
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Get direct stream URL (yt-dlp resolves YouTube's signed URLs)
  const streamUrlProc = Bun.spawn([ytdlp, "-g", "-f", "best[height<=720]", videoUrl]);
  const streamUrl = (await new Response(streamUrlProc.stdout).text()).trim();

  if (!streamUrl) {
    throw new Error("Failed to get video stream URL");
  }

  // Extract single frame at timestamp
  const ffmpegProc = Bun.spawn([
    ffmpeg,
    "-ss", String(timestampSeconds),  // Seek to timestamp
    "-i", streamUrl,                   // Input stream
    "-frames:v", "1",                  // Extract 1 frame
    "-f", "image2pipe",                // Output to stdout
    "-vcodec", "png",                  // PNG format
    "-",                               // Output to stdout
  ]);

  const frameBuffer = await new Response(ffmpegProc.stdout).arrayBuffer();
  return Buffer.from(frameBuffer);
}
```

#### API Endpoint

```typescript
// POST /api/youtube/extract-frame
interface ExtractFrameRequest {
  videoId: string;
  timestamp: number; // seconds
}

interface ExtractFrameResponse {
  imageBase64: string;
}

// In routes
"/api/youtube/extract-frame": {
  POST: async (req) => {
    const { videoId, timestamp } = await req.json();

    try {
      const frameBuffer = await extractFrame(videoId, timestamp);
      const imageBase64 = frameBuffer.toString("base64");
      return Response.json({ imageBase64 });
    } catch (error) {
      return Response.json({ error: "Failed to extract frame" }, { status: 500 });
    }
  },
},
```

#### Error Handling

- **Download failure**: Retry with exponential backoff, show manual install instructions as fallback
- **Extraction failure**: Could be geo-restricted, age-gated, or live stream. Show appropriate error message.
- **Video unavailable**: yt-dlp will fail, catch and show "Video unavailable" message

### Translation API

Create new endpoint that reuses existing translation logic:

```typescript
// POST /api/youtube/translate
interface TranslateFrameRequest {
  imageBase64: string;
  language: Language; // Learning language (ja, zh, ko) - the language visible in the video
}

interface TranslateFrameResponse {
  // SSE stream, same format as /api/chat
}
```

The `language` parameter indicates which language the user is learning (and expects to see in the video). This is used to configure the translation prompt appropriately.

The system prompt should be adapted for video frame context:

```typescript
const YOUTUBE_SYSTEM_PROMPT = `
You are a language learning assistant helping users understand text in video frames.

When analyzing an image:
1. Extract all visible text (subtitles, captions, signs, UI text)
2. Provide translation with word-by-word breakdown
3. Focus on the primary/most prominent text

${TRANSLATION_FORMAT_INSTRUCTIONS}
`;
```

### Image Compression

Reuse existing compression logic from `src/lib/image-compression.ts`:

```typescript
import { compressImageIfNeeded } from "@/lib/image-compression";

// In capture handler
const compressed = await compressImageIfNeeded(frameBuffer);
```

Compression parameters (same as chat):
- Threshold: 2MB
- Max size: 20MB
- Formats: PNG, JPEG, WebP
- Progressive quality reduction if needed

### State Management

Create YouTube-specific store:

```typescript
// src/store/youtube-store.ts
interface YouTubeState {
  videoUrl: string | null;
  videoId: string | null;
  videoTitle: string | null;
  isLoading: boolean;
  currentTranslation: TranslationData | null;

  setVideo: (url: string, id: string, title: string) => void;
  setCurrentTranslation: (data: TranslationData | null) => void;
  clearVideo: () => void;
}
```

Translation history is persisted to the database (`youtube_translations` table) but not loaded into the store. Users browse saved vocabulary through the Meadow, which links back to the YouTube viewer when clicked.

### URL Parsing

Extract video ID from various YouTube URL formats:

```typescript
function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/v\/([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

### UI Components

#### Main Page Layout

```
+------------------------------------------+
|  [YouTube URL input field]    [Load]     |
+------------------------------------------+
|                                          |
|         YouTube Video Player             |
|           (16:9 aspect ratio)            |
|                                          |
+------------------------------------------+
|        [ Translate Frame ]               |
+------------------------------------------+
|                                          |
|         Translation Card                 |
|    (same component as chat uses)         |
|                                          |
+------------------------------------------+
```

- **Translate Frame**: Extracts frame at current timestamp via server-side yt-dlp/ffmpeg and sends to Claude for translation

#### Translation Card

Reuse existing `TranslationCard` component from chat:

```typescript
import { TranslationCard } from "@/features/chat/translation-card";

// In youtube-viewer.tsx
{currentTranslation && (
  <TranslationCard
    data={currentTranslation}
    onSavePetal={handleSavePetal}
  />
)}
```

### Vocabulary Integration (Petals)

Allow users to save words from YouTube translations to their Meadow:

```typescript
// When saving a petal from YouTube
const petal = {
  word: selectedWord.word,
  reading: selectedWord.reading,
  meaning: selectedWord.meaning,
  partOfSpeech: selectedWord.partOfSpeech,
  language: targetLanguage,
  context: `From YouTube video: ${videoTitle}`,
  source_type: "youtube",
  youtube_translation_id: translationId, // References youtube_translations table
};
```

The `youtube_translation_id` links to the `youtube_translations` record which contains the video ID, timestamp, and cached frame image. This avoids duplicating data and ensures the petal can navigate back to the exact source.

### Database Schema Extension

Track YouTube translation history to enable petal saving and source linking:

```sql
CREATE TABLE IF NOT EXISTS youtube_translations (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  video_title TEXT,
  timestamp_seconds REAL NOT NULL,
  frame_image TEXT, -- base64 or file path
  translation_data TEXT, -- JSON
  created_at INTEGER NOT NULL
);
```

Extend the `petals` table to support YouTube sources:

```sql
-- Add columns to petals table
ALTER TABLE petals ADD COLUMN source_type TEXT DEFAULT 'chat'; -- 'chat' | 'youtube'
ALTER TABLE petals ADD COLUMN youtube_translation_id TEXT REFERENCES youtube_translations(id);
```

### Petal Source Navigation

When a user clicks on a petal in the Meadow to view its source context, the navigation behavior depends on the source type:

- **Chat petals** (`source_type = 'chat'`): Navigate to `/chat` and scroll to the original message
- **YouTube petals** (`source_type = 'youtube'`): Navigate to `/youtube` with the video loaded at the saved timestamp

```typescript
// In petal card component (e.g., src/features/meadow/petal-card.tsx)
function handleSourceClick(petal: Petal) {
  if (petal.sourceType === "youtube" && petal.youtubeTranslationId) {
    // Navigate with translation ID - viewer will fetch video details and handle unavailability
    navigate(`/youtube?tid=${petal.youtubeTranslationId}`);
  } else {
    // Existing chat navigation behavior
    navigate(`/chat/${petal.conversationId}?message=${petal.messageId}`);
  }
}
```

The YouTube viewer should handle URL parameters on mount (using Wouter's `useSearch`).

```typescript
// In youtube-viewer.tsx
function YouTubeViewer() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const translationId = params.get("tid"); // From petal navigation
  const directVideoId = params.get("v");   // Direct video link

  const [translation, setTranslation] = useState<YouTubeTranslation | null>(null);

  useEffect(() => {
    if (translationId) {
      // Fetch translation record to get video ID, timestamp, and cached data
      fetchYouTubeTranslation(translationId).then((t) => {
        setTranslation(t);
        loadVideo(t.videoId);
      });
    } else if (directVideoId) {
      loadVideo(directVideoId);
    }
  }, [translationId, directVideoId]);

  // Seek to timestamp once player is ready
  useEffect(() => {
    if (translation && playerRef.current) {
      playerRef.current.seekTo(translation.timestampSeconds);
    }
  }, [translation, playerReady]);
}
```

This enables a complete round-trip: user saves a word from a YouTube frame → views it in Meadow → clicks to return to the exact video moment where they learned it.

### Video Unavailability Handling

Videos may become unavailable after a user saves petals from them (deleted, made private, region-locked, etc.). Handle this gracefully:

#### Detection

The YouTube IFrame API fires an `onError` event when a video can't be played:

```typescript
const player = new YT.Player(container, {
  videoId,
  events: {
    onError: (event) => {
      // Error codes:
      // 2 - Invalid video ID
      // 5 - HTML5 player error
      // 100 - Video not found (deleted/private)
      // 101/150 - Embedding disabled
      if ([100, 101, 150].includes(event.data)) {
        setVideoUnavailable(true);
      }
    },
  },
});
```

#### Fallback UI

When navigating to an unavailable video from a petal, we already have the translation data from the `tid` parameter fetch:

```typescript
function YouTubeViewer() {
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  // translation state is already set from the URL param handling above

  if (videoUnavailable && translation) {
    return <VideoUnavailableFallback translation={translation} />;
  }
  // ... normal player UI
}
```

```typescript
function VideoUnavailableFallback({ translation }: { translation: YouTubeTranslation }) {
  return (
    <div className="video-unavailable">
      <div className="unavailable-message">
        <AlertCircle />
        <h3>Video Unavailable</h3>
        <p>This video is no longer available on YouTube.</p>
      </div>

      {/* Show cached frame thumbnail if we have it */}
      {translation.frameImage && (
        <div className="cached-frame">
          <img src={translation.frameImage} alt="Cached video frame" />
          <span className="timestamp">{formatTimestamp(translation.timestampSeconds)}</span>
        </div>
      )}

      {/* Still show the translation data */}
      <TranslationCard data={JSON.parse(translation.translationData)} />
    </div>
  );
}
```

#### Storage Consideration

To support this fallback, we should store a thumbnail of the captured frame in `youtube_translations.frame_image`. This serves dual purposes:
1. Show context when video becomes unavailable
2. Quick preview in translation history without re-capturing

## Dependencies

### Required

- YouTube IFrame Player API (loaded dynamically)
- yt-dlp (downloaded on first use, pinned version)
- ffmpeg (downloaded on first use, pinned version)

### Binary Management

Binaries are stored in `~/.blossom/bin/` with a `versions.json` manifest:

```
~/.blossom/
├── sqlite.db
├── uploads/
└── bin/
    ├── yt-dlp           # ~22MB
    ├── ffmpeg           # ~80MB
    └── versions.json    # {"ytdlp": "2024.12.13", "ffmpeg": "7.1"}
```

On server startup (before "Blossom server running at" message):
1. Check if `versions.json` exists and matches `TOOL_VERSIONS` in code
2. If mismatch or missing, download fresh binaries with progress output
3. This ensures tools are ready before the user can access the YouTube feature

```typescript
// In src/index.ts, before server starts

async function ensureVideoTools() {
  const binDir = join(blossomDir, "bin");
  const manifestPath = join(binDir, "versions.json");

  // ... version check logic ...

  if (needsDownload) {
    console.log("Downloading video tools...");

    console.log("  yt-dlp...");
    await downloadYtDlp();

    console.log("  ffmpeg...");
    await downloadFfmpeg();

    console.log("  Done\n");
  }
}

// Call before server starts
await ensureVideoTools();

const server = Bun.serve({ ... });

console.log(`\n🌸 Blossom - ようこそ | 欢迎 | 환영합니다`);
console.log(`   Server running at http://localhost:${server.port}\n`);
```

### Platform Support

| Platform      | yt-dlp | ffmpeg |
|---------------|--------|--------|
| macOS arm64   | ✓      | ✓      |
| macOS x64     | ✓      | ✓      |
| Linux x64     | ✓      | ✓      |
| Windows x64   | ✓      | ✓      |

## Security Considerations

1. **URL Validation**: Only accept valid YouTube URLs
2. **Content Size**: Apply same image size limits as chat (20MB max)
3. **Binary Downloads**: Only download from official GitHub release URLs (yt-dlp, ffmpeg-static)
4. **Subprocess Execution**: Only execute downloaded binaries with controlled arguments

## Future Enhancements

1. **Subtitle Integration**: Fetch available subtitles and display alongside
2. **Timestamp Bookmarks**: Save specific timestamps with translations
3. **Batch Translation**: Translate multiple frames in sequence
4. **Playlist Support**: Navigate through playlist videos
5. **Offline Mode**: Cache translations for offline review

## Implementation Phases

### Phase 1: Core Functionality
- Sidebar navigation and routing
- YouTube URL input and player embed
- Video tools download system (yt-dlp + ffmpeg with version pinning)
- Server-side frame extraction via yt-dlp/ffmpeg
- Translation display using existing card component

### Phase 2: History & Integration
- Database schema for youtube_translations
- Translation history storage
- Petal integration for vocabulary saving
- Petal source navigation to YouTube viewer

### Phase 3: Polish
- Video unavailability fallback UI
- Video bookmarking

## Design Decisions

1. **Translation history persistence**: Yes, persist to database. This is required so that petals can reference their source YouTube translation and users can navigate back to the exact video frame.

2. **Petal source navigation**: Clicking a petal from YouTube navigates to `/youtube?tid={translationId}` instead of chat. The viewer fetches the translation record to get video ID, timestamp, and cached frame (for unavailability fallback).

3. **Frame capture method**: Use server-side yt-dlp + ffmpeg for frame extraction. This provides clean frames without YouTube player UI overlay, and avoids browser permission prompts. Binaries are downloaded on first use with pinned versions for compatibility.

4. **Video unavailability**: Store captured frame thumbnails in the database. When a video becomes unavailable, show the cached frame image along with the translation data so users can still review their saved vocabulary in context.

