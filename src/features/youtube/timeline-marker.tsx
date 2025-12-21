import { useState, useCallback } from "react";
import type { YouTubeTranslation } from "./hooks/use-video-translations";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface TimelineMarkerProps {
  translation: YouTubeTranslation;
  position: number; // percentage
  isActive: boolean;
  onClick: () => void;
}

export function TimelineMarker({
  translation,
  position,
  isActive,
  onClick,
}: TimelineMarkerProps) {
  const [showPreview, setShowPreview] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
    },
    [onClick]
  );

  return (
    <div
      className="timeline-marker"
      style={{
        position: "absolute",
        top: "50%",
        left: `${position}%`,
        transform: "translate(-50%, -50%)",
        zIndex: isActive ? 2 : 1,
        cursor: "pointer",
      }}
      onClick={handleClick}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      {/* Marker dot */}
      <div
        style={{
          width: isActive ? "14px" : "10px",
          height: isActive ? "14px" : "10px",
          backgroundColor: isActive ? "var(--primary)" : "var(--text)",
          border: "2px solid var(--surface)",
          borderRadius: "50%",
          transition: "all 0.15s ease",
        }}
      />

      {/* Hover preview */}
      {showPreview && (
        <div
          className="marker-preview"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
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
