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

Due to cross-origin restrictions, we cannot directly capture pixels from a YouTube iframe. We use the Screen Capture API (`getDisplayMedia`) to capture the video frame.

#### Screen Capture Flow

1. User clicks "Start Capture" button to begin a capture session
2. Browser prompts user to select screen/window to share
3. Once permission granted, the stream stays open (browser shows "sharing" indicator)
4. User pauses video at desired frame and clicks "Translate Frame" button
5. We grab a frame from the active stream (no permission prompt)
6. Frame is cropped to the video player region using stored element bounds
7. Image is compressed and sent to Claude API for translation
8. User can translate multiple frames without re-prompting
9. User clicks "Stop Capture" or navigates away to end the session

```typescript
// src/features/youtube/frame-capture.ts

interface CaptureResult {
  imageBlob: Blob;
  timestamp: number;
}

interface PlayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Capture session manager - keeps stream open for multiple frame grabs
class CaptureSession {
  private stream: MediaStream | null = null;
  private imageCapture: ImageCapture | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "window", // Prefer window capture
      },
      audio: false,
    });

    const track = this.stream.getVideoTracks()[0];
    this.imageCapture = new ImageCapture(track);

    // Listen for user clicking "Stop Sharing" in browser UI
    track.onended = () => {
      this.stream = null;
      this.imageCapture = null;
    };
  }

  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }

  async grabFrame(
    currentTimestamp: number,
    playerBounds: PlayerBounds
  ): Promise<CaptureResult> {
    if (!this.imageCapture) {
      throw new Error("Capture session not active");
    }

    const bitmap = await this.imageCapture.grabFrame();

    // Create canvas and crop to player region
    const canvas = document.createElement("canvas");
    canvas.width = playerBounds.width;
    canvas.height = playerBounds.height;
    const ctx = canvas.getContext("2d")!;

    // Calculate scale factor (screen capture may be at different resolution)
    const scaleX = bitmap.width / window.innerWidth;
    const scaleY = bitmap.height / window.innerHeight;

    // Draw only the player region
    ctx.drawImage(
      bitmap,
      playerBounds.x * scaleX,      // source x
      playerBounds.y * scaleY,      // source y
      playerBounds.width * scaleX,  // source width
      playerBounds.height * scaleY, // source height
      0,                            // dest x
      0,                            // dest y
      playerBounds.width,           // dest width
      playerBounds.height           // dest height
    );

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });

    return {
      imageBlob: blob,
      timestamp: currentTimestamp,
    };
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.imageCapture = null;
    }
  }
}

// Get player element bounds before capture
function getPlayerBounds(playerElement: HTMLElement): PlayerBounds {
  const rect = playerElement.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
```

#### UX Considerations

- **Permission dialog**: Browser shows a picker for which screen/window to share. Guide user to select the browser window with the video.
- **Cropping accuracy**: The cropping logic uses player bounds relative to the browser window. If the user selects the entire screen or a different window instead, the crop will be incorrect. This is acceptable - users can retry with the correct selection.
- **Sharing indicator**: Browser shows a "sharing" indicator while the capture session is active. This is expected and the user can stop sharing via the "Stop Capture" button or browser UI when done.
- **First-time guidance**: Show a tooltip or modal explaining the capture flow on first use. Emphasize selecting the browser window (not entire screen).
- **Session cleanup**: Stop the capture session when navigating away or unmounting the component.
- **Error handling**: Handle `NotAllowedError` (user cancelled) gracefully with a friendly message.

```typescript
// In youtube-viewer.tsx
const captureSessionRef = useRef(new CaptureSession());

async function handleStartCapture() {
  try {
    await captureSessionRef.current.start();
    setIsCaptureActive(true);
  } catch (error) {
    if (error.name === "NotAllowedError") {
      showToast("Screen capture cancelled. Click to try again.");
    } else {
      showToast("Failed to start capture.");
    }
  }
}

function handleStopCapture() {
  captureSessionRef.current.stop();
  setIsCaptureActive(false);
}

async function handleTranslateClick() {
  if (!captureSessionRef.current.isActive()) {
    showToast("Start capture first.");
    return;
  }

  try {
    setIsTranslating(true);
    const playerBounds = getPlayerBounds(playerContainerRef.current);
    const { imageBlob, timestamp } = await captureSessionRef.current.grabFrame(
      player.getCurrentTime(),
      playerBounds
    );
    await translateFrame(imageBlob, timestamp);
  } catch (error) {
    showToast("Failed to capture frame. Please try again.");
  } finally {
    setIsTranslating(false);
  }
}

// Clean up on unmount or navigation
useEffect(() => {
  return () => captureSessionRef.current.stop();
}, []);
```

#### Browser Support Check

If Screen Capture API is not available, show a browser not supported message:

```typescript
function YouTubeViewer() {
  const isSupported = "getDisplayMedia" in navigator.mediaDevices;

  if (!isSupported) {
    return (
      <div className="browser-not-supported">
        <AlertCircle />
        <h3>Browser Not Supported</h3>
        <p>
          Your browser doesn't support screen capture.
          Please use a modern browser like Chrome, Firefox, Safari, or Edge.
        </p>
      </div>
    );
  }

  // ... normal UI
}
```

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
| [Start Capture]  or  [Stop Capture]      |
|        [ Translate Frame ]               |
+------------------------------------------+
|                                          |
|         Translation Card                 |
|    (same component as chat uses)         |
|                                          |
+------------------------------------------+
```

- **Start Capture**: Begins screen sharing session (prompts for permission)
- **Stop Capture**: Ends the session (also ends if user clicks browser's "Stop Sharing")
- **Translate Frame**: Only enabled when capture session is active

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
- Screen Capture API (`navigator.mediaDevices.getDisplayMedia`) - supported in all modern browsers

### Browser Compatibility

Screen Capture API support:
- Chrome 72+ ✓
- Firefox 66+ ✓
- Safari 13+ ✓
- Edge 79+ ✓

Unsupported browsers will see a "browser not supported" message.

## Security Considerations

1. **URL Validation**: Only accept valid YouTube URLs
2. **Content Size**: Apply same image size limits as chat (20MB max)
3. **CORS**: YouTube iframe has cross-origin restrictions; handled via Screen Capture API

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
- Screen Capture API frame capture
- Translation display using existing card component
- Image compression pipeline

### Phase 2: History & Integration
- Database schema for youtube_translations
- Translation history storage
- Petal integration for vocabulary saving
- Petal source navigation to YouTube viewer

### Phase 3: Polish
- Video unavailability fallback UI
- First-time user guidance for screen capture flow
- Video bookmarking

## Design Decisions

1. **Translation history persistence**: Yes, persist to database. This is required so that petals can reference their source YouTube translation and users can navigate back to the exact video frame.

2. **Petal source navigation**: Clicking a petal from YouTube navigates to `/youtube?tid={translationId}` instead of chat. The viewer fetches the translation record to get video ID, timestamp, and cached frame (for unavailability fallback).

3. **Frame capture method**: Use Screen Capture API (`getDisplayMedia`) instead of server-side yt-dlp/ffmpeg. This eliminates external dependencies and works entirely in the browser. Unsupported browsers show a "browser not supported" message.

4. **Video unavailability**: Store captured frame thumbnails in the database. When a video becomes unavailable, show the cached frame image along with the translation data so users can still review their saved vocabulary in context.

## Open Questions

1. Do we need to handle age-restricted videos differently?
2. Should we support other video platforms (Bilibili, NicoNico) in the future?
