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
}

export function TranslationTimeline({
  videoDuration,
  currentTime,
  translations,
  activeTranslationId,
  onMarkerClick,
  onSeek,
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
          height: "24px",
          backgroundColor: "var(--border)",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        {/* Progress indicator */}
        <div
          className="timeline-progress"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${(currentTime / videoDuration) * 100}%`,
            backgroundColor: "var(--primary)",
            opacity: 0.3,
            borderRadius: "4px",
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
              onClick={() => onMarkerClick(t)}
            />
          );
        })}
      </div>
    </div>
  );
}
