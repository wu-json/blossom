import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { VideoCard, type RecentVideo } from "./video-card";
import type { Language } from "../../types/chat";

interface RecentVideosGridProps {
  onVideoSelect: (videoId: string, timestamp: number) => void;
  language: Language;
}

const translations: Record<Language, { recentlyTranslated: string }> = {
  ja: { recentlyTranslated: "最近の翻訳" },
  zh: { recentlyTranslated: "最近翻译" },
  ko: { recentlyTranslated: "최근 번역" },
};

export function RecentVideosGrid({ onVideoSelect, language }: RecentVideosGridProps) {
  const [videos, setVideos] = useState<RecentVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchVideos = async (offset: number) => {
    if (loading || (!hasMore && offset > 0)) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/youtube/recent-videos?limit=12&offset=${offset}`
      );
      const data = await response.json();

      const newVideos: RecentVideo[] = data.videos.map((v: {
        video_id: string;
        video_title: string | null;
        translation_count: number;
        latest_frame_image: string | null;
        latest_timestamp_seconds: number;
        latest_created_at: number;
      }) => ({
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
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchVideos(0);
  }, []);

  useEffect(() => {
    if (!loadMoreRef.current || initialLoad) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !loading) {
          fetchVideos(videos.length);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [videos.length, hasMore, loading, initialLoad]);

  if (videos.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="w-full">
      <h3
        className="text-sm font-medium mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        {translations[language].recentlyTranslated}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            onClick={() => onVideoSelect(video.videoId, video.latestTimestampSeconds)}
          />
        ))}
      </div>

      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {loading && <Loader2 className="animate-spin" size={20} style={{ color: "var(--text-muted)" }} />}
      </div>
    </div>
  );
}
