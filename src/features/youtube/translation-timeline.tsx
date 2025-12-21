import { useState, useRef, useCallback } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const isDraggingRef = useRef(false);

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

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    containerRef.current?.classList.add("is-dragging");
  }, []);

  const handleDragEnd = useCallback((id: string, newTimestamp: number) => {
    isDraggingRef.current = false;
    containerRef.current?.classList.remove("is-dragging");
    onMarkerDrag(id, newTimestamp);
  }, [onMarkerDrag]);

  const isExpanded = isHovered;

  return (
    <div
      ref={containerRef}
      className="translation-timeline"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        // Don't collapse while dragging
        if (!isDraggingRef.current) {
          setIsHovered(false);
        }
      }}
    >
      <style>{`
        .translation-timeline.is-dragging .timeline-track {
          height: 32px !important;
          background-color: rgba(255,255,255,0.1) !important;
          border-radius: 6px !important;
        }
        .translation-timeline.is-dragging .timeline-progress {
          height: 3px !important;
        }
      `}</style>
      <div
        ref={trackRef}
        className="timeline-track"
        onClick={handleTrackClick}
        style={{
          position: "relative",
          height: isExpanded ? "32px" : "8px",
          backgroundColor: isExpanded ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.08)",
          borderRadius: isExpanded ? "6px" : "4px",
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          className="timeline-progress"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: isExpanded ? "3px" : "2px",
            width: `${(currentTime / videoDuration) * 100}%`,
            backgroundColor: "var(--primary)",
            borderRadius: "1.5px",
            pointerEvents: "none",
            transition: "height 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: isExpanded ? "0 0 6px var(--primary)" : "none",
          }}
        />

        {translations.map((t) => {
          const position = (t.timestampSeconds / videoDuration) * 100;

          return (
            <TimelineMarker
              key={t.id}
              translation={t}
              position={position}
              isActive={t.id === activeTranslationId}
              isExpanded={isExpanded}
              trackRef={trackRef}
              videoDuration={videoDuration}
              onNavigate={() => onMarkerClick(t)}
              onDragStart={handleDragStart}
              onDragEnd={(newTimestamp) => handleDragEnd(t.id, newTimestamp)}
            />
          );
        })}
      </div>
    </div>
  );
}
