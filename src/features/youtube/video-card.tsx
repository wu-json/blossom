import { Youtube } from "lucide-react";

export interface RecentVideo {
  videoId: string;
  videoTitle: string | null;
  translationCount: number;
  latestFrameImage: string | null;
  latestTimestampSeconds: number;
  latestCreatedAt: number;
}

interface VideoCardProps {
  video: RecentVideo;
  onClick: () => void;
}

export function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl overflow-hidden transition-all hover:opacity-90 hover:scale-[1.02]"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
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
