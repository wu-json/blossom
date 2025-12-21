import { useRef, useCallback } from "react";
import { TimelineMarker } from "./timeline-marker";
import type { YouTubeTranslation } from "./hooks/use-video-translations";

interface TranslationTimelineProps {
  videoDuration: number;
  currentTime: number;
  translations: YouTubeTranslation[];
  activeTranslationId: string | null;
  onMarkerClick: (translation: YouTubeTranslation) => void;
  onSeek: (seconds: number) => void;
  onMarkerDrag: (id: string, newTimestamp: number) => void;
}

export function TranslationTimeline({
  videoDuration,
  currentTime,
  translations,
  activeTranslationId,
  onMarkerClick,
  onSeek,
  onMarkerDrag,
}: TranslationTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const clickPercent = (e.clientX - rect.left) / rect.width;
      const seekTime = clickPercent * videoDuration;

      onSeek(seekTime);
    },
    [videoDuration, onSeek]
  );

  return (
    <div className="translation-timeline">
      <div
        ref={trackRef}
        className="timeline-track"
        onClick={handleTrackClick}
        style={{
          position: "relative",
          height: "44px",
          backgroundColor: "var(--border)",
          borderRadius: "8px",
          cursor: "pointer",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        {/* Progress indicator - thin centered line */}
        <div
          className="timeline-progress"
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            height: "4px",
            width: `${(currentTime / videoDuration) * 100}%`,
            backgroundColor: "var(--primary)",
            opacity: 0.6,
            borderRadius: "2px",
            pointerEvents: "none",
          }}
        />

        {/* Translation markers as points */}
        {translations.map((t) => {
          const position = (t.timestampSeconds / videoDuration) * 100;

          return (
            <TimelineMarker
              key={t.id}
              translation={t}
              position={position}
              isActive={t.id === activeTranslationId}
              trackRef={trackRef}
              videoDuration={videoDuration}
              onNavigate={() => onMarkerClick(t)}
              onDragEnd={(newTimestamp) => onMarkerDrag(t.id, newTimestamp)}
            />
          );
        })}
      </div>
    </div>
  );
}
