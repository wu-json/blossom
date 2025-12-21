import { useRef, useCallback } from "react";
import { TimelineMarker } from "./timeline-marker";
import type { YouTubeTranslation } from "./hooks/use-video-translations";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

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
    <div
      className="translation-timeline"
      style={{
        padding: "12px 16px",
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
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

      {/* Time labels */}
      <div
        className="timeline-labels"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "4px",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        <span>{formatTime(0)}</span>
        <span>{formatTime(videoDuration)}</span>
      </div>
    </div>
  );
}
