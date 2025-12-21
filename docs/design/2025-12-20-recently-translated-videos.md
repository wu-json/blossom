# Recently Translated Videos

**Date:** 2025-12-20
**Status:** Draft

## Overview

Add a paginated infinite scroll section showing recently translated videos on the YouTube "enter link" page. This helps users quickly return to videos they've previously worked with, providing a convenient browsing experience similar to a video history.

## User Flow

1. User navigates to the YouTube tab with no video loaded
2. At the top, the blossom header bar with the URL input field
3. Below the input, an infinite scroll grid of recently translated video thumbnails
4. Each thumbnail shows the video title, thumbnail from the most recent translation, and translation count
5. Clicking a video navigates to `/youtube?v={videoId}&t={timestamp}` and jumps to the most recent translation timestamp
6. Scrolling down loads more videos (paginated)

## UI Layout

```
+--------------------------------------------------+
| [blossom logo] YouTube Translation    [settings] |
+--------------------------------------------------+
| [YouTube URL input field]              [Load]    |
+--------------------------------------------------+
|                                                  |
|  Recently Translated                             |
|                                                  |
|  +-------------+  +-------------+  +-------------+
|  |[frame thumb]|  |[frame thumb]|  |[frame thumb]|
|  | Video Title |  | Video Title |  | Video Title |
|  | 5 translations | 3 translations | 2 translations
|  +-------------+  +-------------+  +-------------+
|                                                  |
|  +-------------+  +-------------+  +-------------+
|  |[frame thumb]|  |[frame thumb]|  |[frame thumb]|
|  | Video Title |  | Video Title |  | Video Title |
|  | 8 translations | 1 translation  | 4 translations
|  +-------------+  +-------------+  +-------------+
|                                                  |
|              [Loading more...]                   |
|                                                  |
+--------------------------------------------------+

Responsive: 1 column on mobile, 2 on tablet, 3 on desktop
```

## Data Model

Use existing `youtube_translations` table. Query distinct videos that have at least one translation entry with non-null `translation_data`.

### New Database Function

```typescript
// src/db/youtube-translations.ts

export interface RecentlyTranslatedVideo {
  video_id: string;
  video_title: string | null;
  translation_count: number;
  latest_frame_image: string | null;
  latest_timestamp_seconds: number;
  latest_created_at: number;
}

export function getRecentlyTranslatedVideos(
  limit: number,
  offset: number
): RecentlyTranslatedVideo[] {
  const stmt = db.prepare(`
    SELECT
      video_id,
      video_title,
      COUNT(*) as translation_count,
      (
        SELECT frame_image
        FROM youtube_translations t2
        WHERE t2.video_id = youtube_translations.video_id
          AND t2.frame_image IS NOT NULL
        ORDER BY t2.created_at DESC
        LIMIT 1
      ) as latest_frame_image,
      (
        SELECT timestamp_seconds
        FROM youtube_translations t3
        WHERE t3.video_id = youtube_translations.video_id
        ORDER BY t3.created_at DESC
        LIMIT 1
      ) as latest_timestamp_seconds,
      MAX(created_at) as latest_created_at
    FROM youtube_translations
    WHERE translation_data IS NOT NULL
    GROUP BY video_id
    ORDER BY latest_created_at DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(limit, offset) as RecentlyTranslatedVideo[];
}

export function getRecentlyTranslatedVideosCount(): number {
  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT video_id) as count
    FROM youtube_translations
    WHERE translation_data IS NOT NULL
  `);

  const result = stmt.get() as { count: number };
  return result.count;
}
```

## API Endpoint

```typescript
// In src/index.ts

// GET /api/youtube/recent-videos?limit=10&offset=0
"/api/youtube/recent-videos": {
  GET: async (req) => {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const videos = getRecentlyTranslatedVideos(
      Math.min(limit, 50), // Cap at 50 per request
      offset
    );
    const total = getRecentlyTranslatedVideosCount();

    return Response.json({
      videos,
      total,
      hasMore: offset + videos.length < total,
    });
  },
},
```

## Frontend Components

### RecentVideosGrid Component

```typescript
// src/features/youtube/recent-videos-grid.tsx

interface RecentVideo {
  videoId: string;
  videoTitle: string | null;
  translationCount: number;
  latestFrameImage: string | null;
  latestTimestampSeconds: number;
  latestCreatedAt: number;
}

interface RecentVideosGridProps {
  onVideoSelect: (videoId: string, timestamp: number) => void;
}

export function RecentVideosGrid({ onVideoSelect }: RecentVideosGridProps) {
  const [videos, setVideos] = useState<RecentVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchVideos = async (offset: number) => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/youtube/recent-videos?limit=10&offset=${offset}`
      );
      const data = await response.json();

      const newVideos = data.videos.map((v: any) => ({
        videoId: v.video_id,
        videoTitle: v.video_title,
        translationCount: v.translation_count,
        latestFrameImage: v.latest_frame_image,
        latestTimestampSeconds: v.latest_timestamp_seconds,
        latestCreatedAt: v.latest_created_at,
      }));

      setVideos((prev) =>
        offset === 0 ? newVideos : [...prev, ...newVideos]
      );
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchVideos(0);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchVideos(videos.length);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [videos.length, hasMore, loading]);

  if (videos.length === 0 && !loading) {
    return null; // Don't show section if no videos
  }

  return (
    <div className="mt-8 w-full max-w-3xl">
      <h3
        className="text-sm font-medium mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Recently Translated
      </h3>

      {/* Responsive grid: 1 col on mobile, 2 on sm, 3 on lg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            onClick={() => onVideoSelect(video.videoId, video.latestTimestampSeconds)}
          />
        ))}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {loading && <Loader2 className="animate-spin" size={20} />}
      </div>
    </div>
  );
}
```

### VideoCard Component

```typescript
// src/features/youtube/video-card.tsx

interface VideoCardProps {
  video: RecentVideo;
  onClick: () => void;
}

function VideoCard({ video, onClick }: VideoCardProps) {
  const language = useChatStore((state) => state.language);

  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl overflow-hidden transition-all hover:opacity-90 hover:scale-[1.02]"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="aspect-video bg-cover bg-center"
        style={{
          backgroundImage: video.latestFrameImage
            ? `url(/api/youtube/frames/${video.latestFrameImage})`
            : undefined,
          backgroundColor: "var(--border)",
        }}
      >
        {!video.latestFrameImage && (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube size={32} style={{ color: "var(--text-muted)" }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4
          className="text-sm font-medium line-clamp-2 mb-1"
          style={{ color: "var(--text)" }}
        >
          {video.videoTitle || "Untitled Video"}
        </h4>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {video.translationCount}{" "}
          {video.translationCount === 1 ? "translation" : "translations"}
        </p>
      </div>
    </button>
  );
}
```

### Integration into YouTubeViewer

Modify the "no video loaded" state in `youtube-viewer.tsx`:

```typescript
{!videoId && (
  <div className="flex flex-col h-full">
    {/* Header - unchanged */}
    <header className="sticky top-0 z-10 px-4 py-3 border-b ...">
      ...
    </header>

    {/* Scrollable content area */}
    <div className="flex-1 overflow-auto">
      <div className="flex flex-col items-center px-6 py-10">
        {/* Title and input - moved to top */}
        <h3 className="font-medium mb-1" style={{ color: "var(--text)" }}>
          {translations[language].title}
        </h3>
        <p className="text-sm mb-6 max-w-sm text-center">
          {translations[language].description}
        </p>
        <div className="flex gap-2 w-full max-w-md">
          <input ... />
          <button ... />
        </div>

        {/* Recently translated videos - infinite scroll */}
        <RecentVideosGrid
          onVideoSelect={(videoId, timestamp) => {
            setVideo(
              `https://www.youtube.com/watch?v=${videoId}`,
              videoId,
              null
            );
            setCurrentTimestamp(timestamp);
            setLocation(`/youtube?v=${videoId}&t=${Math.floor(timestamp)}`);
          }}
        />
      </div>
    </div>
  </div>
)}
```

## Localization

Add translations for the new UI strings:

```typescript
// In youtube-viewer.tsx translations object
const translations: Record<Language, {
  // ... existing keys ...
  recentlyTranslated: string;
  translation: string;
  translations: string;
}> = {
  ja: {
    // ... existing ...
    recentlyTranslated: "最近の翻訳",
    translation: "件の翻訳",
    translations: "件の翻訳",
  },
  zh: {
    // ... existing ...
    recentlyTranslated: "最近翻译",
    translation: "条翻译",
    translations: "条翻译",
  },
  ko: {
    // ... existing ...
    recentlyTranslated: "최근 번역",
    translation: "개 번역",
    translations: "개 번역",
  },
};
```

## Performance Considerations

1. **Pagination**: Fetch 10 videos at a time to avoid loading too much data
2. **Thumbnail caching**: Frame images are already stored in `~/.blossom/frames/`, served via existing `/api/youtube/frames/:filename` endpoint
3. **Intersection Observer**: Only fetch more when user scrolls near the bottom
4. **Request debouncing**: Prevent duplicate requests while one is in flight

## Edge Cases

1. **No translations yet**: Don't show the "Recently Translated" section if no videos have translations
2. **Missing thumbnails**: Show YouTube icon placeholder if `latest_frame_image` is null
3. **Missing titles**: Display "Untitled Video" if `video_title` is null
4. **Deleted videos**: Videos may be unavailable on YouTube - clicking still navigates, and the viewer handles unavailability with cached frames

## Implementation Phases

### Phase 1: Backend
- Add `getRecentlyTranslatedVideos` and `getRecentlyTranslatedVideosCount` to db layer
- Add `/api/youtube/recent-videos` endpoint

### Phase 2: Frontend
- Create `RecentVideosGrid` component with infinite scroll
- Create `VideoCard` component
- Integrate into YouTubeViewer's empty state

### Phase 3: Polish
- Add loading skeletons
- Add localized strings
- Test infinite scroll behavior
