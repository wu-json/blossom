# YouTube Translation Timeline

**Date:** 2025-12-20
**Status:** Draft

## Overview

The YouTube Translation Timeline adds a visual timeline component below the YouTube player that displays all saved translations for a video. As the video plays, the timeline highlights the nearest translation, and users can click on timeline markers to view specific translation breakdowns.

## User Flow

1. User opens a YouTube video in the viewer
2. If the video has saved translations, timeline markers appear below the player
3. As the video plays, the nearest translation is highlighted on the timeline
4. The active translation's breakdown card is displayed below the timeline
5. User can click any timeline marker to jump to that translation
6. New translations are added to the timeline as they're created

## Technical Design

### Component Structure

```
src/features/youtube/
├── youtube-viewer.tsx          # Main page (existing)
├── youtube-player.tsx          # Player wrapper (existing)
├── translation-panel.tsx       # Translation display (existing)
├── translation-timeline.tsx    # NEW: Timeline component
├── timeline-marker.tsx         # NEW: Individual marker
└── hooks/
    └── use-video-translations.ts  # NEW: Fetch/manage translations
```

### Timeline Component

```typescript
// src/features/youtube/translation-timeline.tsx

interface TimelineProps {
  videoId: string;
  videoDuration: number; // seconds
  currentTime: number; // seconds
  translations: YouTubeTranslation[];
  activeTranslationId: string | null;
  onMarkerClick: (translation: YouTubeTranslation) => void;
}

function TranslationTimeline({
  videoId,
  videoDuration,
  currentTime,
  translations,
  activeTranslationId,
  onMarkerClick,
}: TimelineProps) {
  return (
    <div className="translation-timeline">
      <div className="timeline-track">
        {/* Progress indicator */}
        <div
          className="timeline-progress"
          style={{ width: `${(currentTime / videoDuration) * 100}%` }}
        />

        {/* Translation markers */}
        {translations.map((t) => (
          <TimelineMarker
            key={t.id}
            translation={t}
            position={(t.timestampSeconds / videoDuration) * 100}
            isActive={t.id === activeTranslationId}
            onClick={() => onMarkerClick(t)}
          />
        ))}
      </div>

      {/* Time labels */}
      <div className="timeline-labels">
        <span>{formatTime(0)}</span>
        <span>{formatTime(videoDuration)}</span>
      </div>
    </div>
  );
}
```

### Timeline Marker Component

```typescript
// src/features/youtube/timeline-marker.tsx

interface MarkerProps {
  translation: YouTubeTranslation;
  position: number; // percentage
  isActive: boolean;
  onClick: () => void;
}

function TimelineMarker({ translation, position, isActive, onClick }: MarkerProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div
      className={cn(
        "timeline-marker",
        isActive && "timeline-marker-active"
      )}
      style={{ left: `${position}%` }}
      onClick={onClick}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      <div className="marker-dot" />

      {/* Hover preview */}
      {showPreview && (
        <div className="marker-preview">
          <span className="preview-time">{formatTime(translation.timestampSeconds)}</span>
          <span className="preview-text">{translation.translationData.originalText}</span>
        </div>
      )}
    </div>
  );
}
```

### Active Translation Detection

Determine which translation is "nearest" to current playback position:

```typescript
// src/features/youtube/hooks/use-active-translation.ts

function useActiveTranslation(
  translations: YouTubeTranslation[],
  currentTime: number,
  threshold: number = 5 // seconds
): YouTubeTranslation | null {
  return useMemo(() => {
    if (translations.length === 0) return null;

    // Sort by timestamp
    const sorted = [...translations].sort(
      (a, b) => a.timestampSeconds - b.timestampSeconds
    );

    // Find the most recent translation that we've passed or are near
    let nearest: YouTubeTranslation | null = null;

    for (const t of sorted) {
      if (t.timestampSeconds <= currentTime) {
        // We've passed this translation - it becomes the active one
        nearest = t;
      } else if (t.timestampSeconds - currentTime <= threshold) {
        // We're approaching this translation (within threshold)
        // Only use if we haven't passed any yet
        if (!nearest) {
          nearest = t;
        }
        break;
      } else {
        // Past the threshold for upcoming translations
        break;
      }
    }

    // If we've passed all translations, keep showing the last one
    // (don't clear - user can review while video continues)
    if (!nearest && sorted.length > 0) {
      nearest = sorted[sorted.length - 1];
    }

    return nearest;
  }, [translations, currentTime, threshold]);
}
```

### Fetching Translations for a Video

```typescript
// src/features/youtube/hooks/use-video-translations.ts

interface UseVideoTranslationsResult {
  translations: YouTubeTranslation[];
  isLoading: boolean;
  addTranslation: (translation: YouTubeTranslation) => void;
  refetch: () => Promise<void>;
}

function useVideoTranslations(videoId: string | null): UseVideoTranslationsResult {
  const [translations, setTranslations] = useState<YouTubeTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTranslations = useCallback(async () => {
    if (!videoId) {
      setTranslations([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/youtube/translations?videoId=${videoId}`);
      const data = await response.json();
      setTranslations(data.translations);
    } catch (error) {
      console.error("Failed to fetch translations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const addTranslation = useCallback((translation: YouTubeTranslation) => {
    setTranslations((prev) => [...prev, translation].sort(
      (a, b) => a.timestampSeconds - b.timestampSeconds
    ));
  }, []);

  return {
    translations,
    isLoading,
    addTranslation,
    refetch: fetchTranslations,
  };
}
```

### API Endpoint

Add endpoint to fetch translations by video ID:

```typescript
// GET /api/youtube/translations?videoId={videoId}

interface GetTranslationsResponse {
  translations: YouTubeTranslation[];
}

// In src/index.ts routes
"/api/youtube/translations": {
  GET: async (req) => {
    const url = new URL(req.url);
    const videoId = url.searchParams.get("videoId");

    if (!videoId) {
      return Response.json({ error: "videoId required" }, { status: 400 });
    }

    const translations = getYouTubeTranslationsByVideoId(videoId);
    return Response.json({ translations });
  },
},
```

### Database Query

```typescript
// src/db/youtube-translations.ts

function getYouTubeTranslationsByVideoId(videoId: string): YouTubeTranslation[] {
  const stmt = db.prepare(`
    SELECT id, video_id, video_title, timestamp_seconds, frame_image, translation_data, created_at
    FROM youtube_translations
    WHERE video_id = ?
    ORDER BY timestamp_seconds ASC
  `);

  const rows = stmt.all(videoId);

  return rows.map((row) => ({
    id: row.id,
    videoId: row.video_id,
    videoTitle: row.video_title,
    timestampSeconds: row.timestamp_seconds,
    frameImage: row.frame_image,
    translationData: JSON.parse(row.translation_data),
    createdAt: row.created_at,
  }));
}
```

### Integrating into YouTube Viewer

```typescript
// src/features/youtube/youtube-viewer.tsx

function YouTubeViewer() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const playerRef = useRef<YT.Player | null>(null);

  const { translations, addTranslation } = useVideoTranslations(videoId);

  const activeTranslation = useActiveTranslation(translations, currentTime);

  // Poll current time from player
  useEffect(() => {
    if (!playerRef.current) return;

    const interval = setInterval(() => {
      const time = playerRef.current?.getCurrentTime() ?? 0;
      setCurrentTime(time);
    }, 250); // Update 4x per second

    return () => clearInterval(interval);
  }, [playerRef.current]);

  const handleMarkerClick = (translation: YouTubeTranslation) => {
    // Seek player to translation timestamp
    playerRef.current?.seekTo(translation.timestampSeconds, true);
    // Translation card will update automatically via activeTranslation
  };

  const handleTranslationCreated = (translation: YouTubeTranslation) => {
    // Add new translation to local state
    addTranslation(translation);
  };

  return (
    <div className="youtube-viewer">
      <YouTubeUrlInput onSubmit={handleLoadVideo} />

      {videoId && (
        <>
          <YouTubePlayer
            videoId={videoId}
            onReady={(player, videoData) => {
              playerRef.current = player;
              setVideoDuration(player.getDuration());
            }}
          />

          {/* Timeline below player */}
          {translations.length > 0 && (
            <TranslationTimeline
              videoId={videoId}
              videoDuration={videoDuration}
              currentTime={currentTime}
              translations={translations}
              activeTranslationId={activeTranslation?.id ?? null}
              onMarkerClick={handleMarkerClick}
            />
          )}

          <TranslateFrameButton
            onTranslationCreated={handleTranslationCreated}
          />

          {/* Show active translation card */}
          {activeTranslation && (
            <TranslationCard
              data={activeTranslation.translationData}
              onSavePetal={handleSavePetal}
            />
          )}
        </>
      )}
    </div>
  );
}
```

### UI Layout

```
+------------------------------------------+
|  [YouTube URL input field]    [Load]     |
+------------------------------------------+
|                                          |
|         YouTube Video Player             |
|           (16:9 aspect ratio)            |
|                                          |
+------------------------------------------+
| [●]--[●]--------[●]----[●]--[●]-------→ |  <- Timeline with markers
| 0:00                              12:34  |
+------------------------------------------+
|        [ Translate Frame ]               |
+------------------------------------------+
|                                          |
|    Active Translation Card               |
|    (auto-updates as video plays)         |
|                                          |
+------------------------------------------+
```

### Styling

```css
/* Timeline track */
.translation-timeline {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.timeline-track {
  position: relative;
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.timeline-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--accent-color);
  border-radius: 4px;
  pointer-events: none;
}

/* Markers */
.timeline-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  cursor: pointer;
}

.marker-dot {
  width: 12px;
  height: 12px;
  background: var(--text-primary);
  border: 2px solid var(--bg-primary);
  border-radius: 50%;
  transition: transform 0.15s ease;
}

.timeline-marker:hover .marker-dot,
.timeline-marker-active .marker-dot {
  transform: scale(1.4);
  background: var(--accent-color);
}

/* Hover preview */
.marker-preview {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  white-space: nowrap;
  font-size: 12px;
}

.preview-time {
  color: var(--text-secondary);
  margin-right: 8px;
}

.preview-text {
  color: var(--text-primary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Time labels */
.timeline-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}
```

### Empty State

When a video has no translations yet:

```typescript
{translations.length === 0 && videoId && (
  <div className="timeline-empty">
    <span>No translations yet. Press "Translate Frame" to add one.</span>
  </div>
)}
```

### Index on video_id

Add database index for efficient lookups:

```sql
CREATE INDEX IF NOT EXISTS idx_youtube_translations_video_id
ON youtube_translations(video_id);
```

## Behavior Details

### Auto-Scroll on Active Change

When the active translation changes during playback, scroll the translation card into view if needed:

```typescript
const cardRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (activeTranslation && cardRef.current) {
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}, [activeTranslation?.id]);
```

### Threshold Configuration

The "nearest" detection threshold (default 5 seconds) could be configurable:
- Shorter threshold: Only show translations very close to current time
- Longer threshold: Keep showing translation until next one appears

### Click vs Playback Priority

When user clicks a marker:
1. Player seeks to that timestamp
2. Active translation updates via nearest algorithm (naturally selects clicked one)
3. Normal playback-based detection continues

### New Translation Creation

When user clicks "Translate Frame":
1. Translation is created and saved to database
2. New translation is added to local timeline state via `addTranslation()`
3. Nearest algorithm naturally selects it (since it was just created at current timestamp)
4. No special handling needed - the algorithm handles it

## Implementation Steps

1. Create `TranslationTimeline` and `TimelineMarker` components
2. Add `useVideoTranslations` hook for fetching translations
3. Add `useActiveTranslation` hook for nearest detection
4. Add `GET /api/youtube/translations` endpoint
5. Add `getYouTubeTranslationsByVideoId` database function
6. Add database index on `video_id`
7. Integrate timeline into `YouTubeViewer`
8. Add polling for current playback time
9. Style timeline components
10. Test with videos that have multiple translations

## Dependencies

No new dependencies required. Uses:
- Existing YouTube IFrame Player API
- Existing database layer
- Existing UI primitives

## Future Enhancements

1. **Drag to scrub**: Click and drag on timeline to preview translations
2. **Keyboard navigation**: Left/right arrows to jump between translations
3. **Minimap thumbnails**: Show frame thumbnails on marker hover
4. **Export timeline**: Export all translations for a video as subtitles (SRT/VTT)
5. **Auto-translate mode**: Automatically translate frame every N seconds
