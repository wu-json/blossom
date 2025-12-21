# YouTube Translation Timeline

**Date:** 2025-12-20
**Status:** Draft

## Overview

The YouTube Translation Timeline adds a visual timeline component below the YouTube player that displays all saved translations for a video. Translations appear as range segments on the timeline—when playback enters a translation's range, its breakdown card is displayed. Users can click markers to jump to translations and drag to adjust each translation's duration.

## User Flow

1. User opens a YouTube video in the viewer
2. If the video has saved translations, timeline shows range segments below the player
3. As video plays, when playback enters a translation's range, it becomes active
4. The active translation's breakdown card is displayed below the timeline
5. User can click any timeline segment to jump to that translation
6. User can drag the end of a segment to adjust how long the translation stays active
7. New translations are added to the timeline as they're created (default 5 second duration)

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
  onDurationChange: (translationId: string, durationSeconds: number) => void;
  onSeek: (seconds: number) => void;
}

function TranslationTimeline({
  videoId,
  videoDuration,
  currentTime,
  translations,
  activeTranslationId,
  onMarkerClick,
  onDurationChange,
  onSeek,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Click on track to seek
  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const clickPercent = (e.clientX - rect.left) / rect.width;
    const seekTime = clickPercent * videoDuration;

    onSeek(seekTime);
  };

  return (
    <div className="translation-timeline">
      <div
        ref={trackRef}
        className="timeline-track"
        onClick={handleTrackClick}
      >
        {/* Progress indicator */}
        <div
          className="timeline-progress"
          style={{ width: `${(currentTime / videoDuration) * 100}%` }}
        />

        {/* Translation markers as range segments */}
        {translations.map((t) => {
          const startPercent = (t.timestampSeconds / videoDuration) * 100;
          const endPercent = ((t.timestampSeconds + t.durationSeconds) / videoDuration) * 100;

          return (
            <TimelineMarker
              key={t.id}
              translation={t}
              startPosition={startPercent}
              endPosition={endPercent}
              videoDuration={videoDuration}
              isActive={t.id === activeTranslationId}
              onClick={() => onMarkerClick(t)}
              onDurationChange={(duration) => onDurationChange(t.id, duration)}
            />
          );
        })}
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

Each marker displays as a range segment showing when the translation is active. Users can drag the right edge to adjust the duration.

```typescript
// src/features/youtube/timeline-marker.tsx

interface MarkerProps {
  translation: YouTubeTranslation;
  startPosition: number; // percentage
  endPosition: number; // percentage (start + duration)
  videoDuration: number;
  isActive: boolean;
  onClick: () => void;
  onDurationChange: (newDurationSeconds: number) => void;
}

function TimelineMarker({
  translation,
  startPosition,
  endPosition,
  videoDuration,
  isActive,
  onClick,
  onDurationChange,
}: MarkerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrag = (e: MouseEvent, trackWidth: number) => {
    if (!isDragging) return;

    const trackRect = e.currentTarget.getBoundingClientRect();
    const newEndPercent = ((e.clientX - trackRect.left) / trackWidth) * 100;
    const newDuration = ((newEndPercent - startPosition) / 100) * videoDuration;

    // Minimum 1 second, maximum until next translation or end
    const clampedDuration = Math.max(1, Math.min(newDuration, maxAllowedDuration));
    onDurationChange(clampedDuration);
  };

  return (
    <div
      className={cn(
        "timeline-marker",
        isActive && "timeline-marker-active"
      )}
      style={{
        left: `${startPosition}%`,
        width: `${endPosition - startPosition}%`,
      }}
      onClick={onClick}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      {/* Range segment */}
      <div className="marker-range" />

      {/* Start dot */}
      <div className="marker-dot marker-dot-start" />

      {/* Draggable end handle */}
      <div
        className="marker-handle"
        onMouseDown={handleDragStart}
      />

      {/* Hover preview */}
      {showPreview && !isDragging && (
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

Pure range-based detection - a translation is active only when current time falls within its range:

```typescript
// src/features/youtube/hooks/use-active-translation.ts

const DEFAULT_DURATION_SECONDS = 5;

function useActiveTranslation(
  translations: YouTubeTranslation[],
  currentTime: number
): YouTubeTranslation | null {
  return useMemo(() => {
    if (translations.length === 0) return null;

    // Find translation whose range contains current time
    for (const t of translations) {
      const start = t.timestampSeconds;
      const end = start + (t.durationSeconds ?? DEFAULT_DURATION_SECONDS);

      if (currentTime >= start && currentTime <= end) {
        return t;
      }
    }

    // Not within any range - show nothing
    return null;
  }, [translations, currentTime]);
}
```

### Fetching Translations for a Video

```typescript
// src/features/youtube/hooks/use-video-translations.ts

interface UseVideoTranslationsResult {
  translations: YouTubeTranslation[];
  isLoading: boolean;
  addTranslation: (translation: YouTubeTranslation) => void;
  updateDuration: (translationId: string, durationSeconds: number) => void;
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

  const updateDuration = useCallback(async (translationId: string, durationSeconds: number) => {
    // Optimistic update
    setTranslations((prev) =>
      prev.map((t) =>
        t.id === translationId ? { ...t, durationSeconds } : t
      )
    );

    // Persist to server
    await fetch(`/api/youtube/translations/${translationId}/duration`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds }),
    });
  }, []);

  return {
    translations,
    isLoading,
    addTranslation,
    updateDuration,
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
    SELECT id, video_id, video_title, timestamp_seconds, duration_seconds, frame_image, translation_data, created_at
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
    durationSeconds: row.duration_seconds,
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

  const { translations, addTranslation, updateDuration } = useVideoTranslations(videoId);

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
  };

  const handleSeek = (seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  };

  const handleDurationChange = (translationId: string, durationSeconds: number) => {
    updateDuration(translationId, durationSeconds);
  };

  const handleTranslationCreated = (translation: YouTubeTranslation) => {
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
              onDurationChange={handleDurationChange}
              onSeek={handleSeek}
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
| [●══]  [●═══════]   [●══]  [●═══]-----→ |  <- Timeline with range segments
| 0:00                              12:34  |
+------------------------------------------+
|        [ Translate Frame ]               |
+------------------------------------------+
|                                          |
|    Active Translation Card               |
|    (shows when playback is in range)     |
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
  height: 24px;
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
  opacity: 0.3;
  border-radius: 4px;
  pointer-events: none;
}

/* Markers as range segments */
.timeline-marker {
  position: absolute;
  top: 4px;
  bottom: 4px;
  z-index: 1;
  cursor: pointer;
}

.marker-range {
  position: absolute;
  inset: 0;
  background: var(--text-secondary);
  opacity: 0.4;
  border-radius: 3px;
  transition: opacity 0.15s ease;
}

.timeline-marker:hover .marker-range,
.timeline-marker-active .marker-range {
  opacity: 0.7;
  background: var(--accent-color);
}

/* Start dot */
.marker-dot-start {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: var(--text-primary);
  border: 2px solid var(--bg-primary);
  border-radius: 50%;
  z-index: 2;
}

.timeline-marker-active .marker-dot-start {
  background: var(--accent-color);
}

/* Draggable end handle */
.marker-handle {
  position: absolute;
  right: -4px;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  background: transparent;
  z-index: 3;
}

.marker-handle::after {
  content: '';
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 12px;
  background: var(--text-tertiary);
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.timeline-marker:hover .marker-handle::after {
  opacity: 1;
}

/* Hover preview */
.marker-preview {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  white-space: nowrap;
  font-size: 12px;
  z-index: 10;
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

### Database Schema Extension

Add `duration_seconds` column to track each translation's active range:

```sql
-- Add duration column to youtube_translations (default 5 seconds)
ALTER TABLE youtube_translations ADD COLUMN duration_seconds REAL DEFAULT 5.0;
```

Add database index for efficient lookups:

```sql
CREATE INDEX IF NOT EXISTS idx_youtube_translations_video_id
ON youtube_translations(video_id);
```

### Update Duration API

```typescript
// PATCH /api/youtube/translations/:id/duration

interface UpdateDurationRequest {
  durationSeconds: number;
}

// In src/index.ts routes
"/api/youtube/translations/:id/duration": {
  PATCH: async (req, params) => {
    const { durationSeconds } = await req.json();
    const { id } = params;

    if (durationSeconds < 1) {
      return Response.json({ error: "Duration must be at least 1 second" }, { status: 400 });
    }

    updateYouTubeTranslationDuration(id, durationSeconds);
    return Response.json({ success: true });
  },
},
```

```typescript
// src/db/youtube-translations.ts

function updateYouTubeTranslationDuration(id: string, durationSeconds: number): void {
  const stmt = db.prepare(`
    UPDATE youtube_translations
    SET duration_seconds = ?
    WHERE id = ?
  `);
  stmt.run(durationSeconds, id);
}
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

### Click vs Playback Priority

When user clicks a marker:
1. Player seeks to that timestamp
2. Active translation updates via range detection (seeked position is within clicked translation's range)
3. Normal playback-based detection continues

### New Translation Creation

When user clicks "Translate Frame":
1. Translation is created and saved to database with default duration (5 seconds)
2. New translation is added to local timeline state via `addTranslation()`
3. Range detection naturally selects it (current timestamp is within its range)
4. User can drag the end handle to extend or shrink the range as needed

## Implementation Steps

1. Add `duration_seconds` column to `youtube_translations` table
2. Create `TranslationTimeline` and `TimelineMarker` components
3. Add `useVideoTranslations` hook for fetching/updating translations
4. Add `useActiveTranslation` hook for range-based detection
5. Add `GET /api/youtube/translations` endpoint
6. Add `PATCH /api/youtube/translations/:id/duration` endpoint
7. Add `getYouTubeTranslationsByVideoId` database function
8. Add `updateYouTubeTranslationDuration` database function
9. Add database index on `video_id`
10. Integrate timeline into `YouTubeViewer`
11. Implement drag-to-resize for duration adjustment
12. Add click-to-seek on timeline track
13. Add polling for current playback time
14. Style timeline components
15. Test with videos that have multiple translations

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
