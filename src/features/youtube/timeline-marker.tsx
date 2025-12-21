import { useState, useCallback, useEffect } from "react";
import type { YouTubeTranslation } from "./hooks/use-video-translations";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface TimelineMarkerProps {
  translation: YouTubeTranslation;
  startPosition: number;
  endPosition: number;
  videoDuration: number;
  isActive: boolean;
  onClick: () => void;
  onDurationChange: (newDurationSeconds: number) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
  maxEndPosition: number;
}

export function TimelineMarker({
  translation,
  startPosition,
  endPosition,
  videoDuration,
  isActive,
  onClick,
  onDurationChange,
  trackRef,
  maxEndPosition,
}: TimelineMarkerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current) return;

      const trackRect = trackRef.current.getBoundingClientRect();
      const newEndPercent = ((e.clientX - trackRect.left) / trackRect.width) * 100;
      const newDuration = ((newEndPercent - startPosition) / 100) * videoDuration;

      // Minimum 1 second, maximum until next translation or end of video
      const maxDuration = ((maxEndPosition - startPosition) / 100) * videoDuration;
      const clampedDuration = Math.max(1, Math.min(newDuration, maxDuration));
      onDurationChange(clampedDuration);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, trackRef, startPosition, videoDuration, maxEndPosition, onDurationChange]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isDragging) {
        onClick();
      }
    },
    [isDragging, onClick]
  );

  return (
    <div
      className="timeline-marker"
      style={{
        position: "absolute",
        top: "4px",
        bottom: "4px",
        left: `${startPosition}%`,
        width: `${endPosition - startPosition}%`,
        minWidth: "8px",
        zIndex: isActive ? 2 : 1,
        cursor: "pointer",
      }}
      onClick={handleClick}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => !isDragging && setShowPreview(false)}
    >
      {/* Range segment */}
      <div
        className="marker-range"
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: isActive ? "var(--primary)" : "var(--text-muted)",
          opacity: isActive ? 0.7 : 0.4,
          borderRadius: "3px",
          transition: "opacity 0.15s ease, background-color 0.15s ease",
        }}
      />

      {/* Start dot */}
      <div
        className="marker-dot-start"
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "10px",
          height: "10px",
          backgroundColor: isActive ? "var(--primary)" : "var(--text)",
          border: "2px solid var(--surface)",
          borderRadius: "50%",
          zIndex: 2,
        }}
      />

      {/* Draggable end handle */}
      <div
        className="marker-handle"
        style={{
          position: "absolute",
          right: "-4px",
          top: 0,
          bottom: 0,
          width: "8px",
          cursor: "ew-resize",
          zIndex: 3,
        }}
        onMouseDown={handleDragStart}
      >
        <div
          style={{
            position: "absolute",
            right: "2px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "4px",
            height: "12px",
            backgroundColor: "var(--text-muted)",
            borderRadius: "2px",
            opacity: showPreview || isDragging ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
        />
      </div>

      {/* Hover preview */}
      {showPreview && !isDragging && (
        <div
          className="marker-preview"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: "8px",
            padding: "6px 10px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            whiteSpace: "nowrap",
            fontSize: "12px",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "var(--text-muted)", marginRight: "8px" }}>
            {formatTime(translation.timestampSeconds)}
          </span>
          <span
            style={{
              color: "var(--text)",
              maxWidth: "200px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "inline-block",
              verticalAlign: "bottom",
            }}
          >
            {translation.translationData?.originalText || "Translation"}
          </span>
        </div>
      )}
    </div>
  );
}
