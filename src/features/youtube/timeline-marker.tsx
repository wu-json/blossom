import { useState, useRef, useEffect } from "react";
import type { YouTubeTranslation } from "./hooks/use-video-translations";
import { useDraggableMarker } from "./hooks/use-draggable-marker";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface TimelineMarkerProps {
  translation: YouTubeTranslation;
  position: number; // percentage
  isActive: boolean;
  trackRef: React.RefObject<HTMLDivElement | null>;
  videoDuration: number;
  onNavigate: () => void;
  onDragEnd: (newTimestamp: number) => void;
}

export function TimelineMarker({
  translation,
  position: initialPosition,
  isActive,
  trackRef,
  videoDuration,
  onNavigate,
  onDragEnd,
}: TimelineMarkerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const previewTimeRef = useRef<HTMLSpanElement | null>(null);

  const { isDragging, markerRef, handlers } = useDraggableMarker({
    initialPosition,
    trackRef,
    videoDuration,
    onNavigate,
    onDragEnd,
  });

  // Update preview time during drag via DOM
  useEffect(() => {
    if (!isDragging || !markerRef.current || !previewTimeRef.current) return;

    const updatePreviewTime = () => {
      if (!markerRef.current || !previewTimeRef.current) return;
      const leftStr = markerRef.current.style.left;
      const position = parseFloat(leftStr) || initialPosition;
      const timestamp = (position / 100) * videoDuration;
      previewTimeRef.current.textContent = formatTime(timestamp);
      if (isDragging) {
        requestAnimationFrame(updatePreviewTime);
      }
    };

    requestAnimationFrame(updatePreviewTime);
  }, [isDragging, videoDuration, initialPosition, markerRef]);

  return (
    <div
      ref={markerRef}
      className="timeline-marker"
      style={{
        position: "absolute",
        top: "50%",
        left: `${initialPosition}%`,
        transform: `translate(-50%, -50%) ${isDragging ? "scale(1.15)" : "scale(1)"}`,
        zIndex: isDragging ? 10 : isActive ? 2 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        transition: isDragging ? "transform 0.1s ease" : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => !isDragging && setShowPreview(false)}
      {...handlers}
    >
      {/* Larger invisible hit area for easier grabbing */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "32px",
          height: "32px",
          borderRadius: "50%",
        }}
      />

      {/* Marker dot */}
      <div
        style={{
          width: isActive ? "20px" : "16px",
          height: isActive ? "20px" : "16px",
          backgroundColor: isActive ? "var(--primary)" : "rgba(255, 255, 255, 0.35)",
          border: "2px solid var(--surface)",
          borderRadius: "50%",
          transition: isDragging
            ? "none"
            : "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: isDragging
            ? "0 4px 12px rgba(0,0,0,0.25)"
            : isActive
              ? "0 2px 6px rgba(0,0,0,0.15)"
              : "0 1px 3px rgba(0,0,0,0.1)",
        }}
      />

      {/* Hover/Drag preview */}
      {(showPreview || isDragging) && (
        <div
          className="marker-preview"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "12px",
            padding: "8px 12px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            whiteSpace: "nowrap",
            fontSize: "12px",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span
            ref={previewTimeRef}
            style={{
              color: isDragging ? "var(--primary)" : "var(--text-muted)",
              marginRight: isDragging ? 0 : "8px",
              fontWeight: isDragging ? 500 : 400,
            }}
          >
            {formatTime((initialPosition / 100) * videoDuration)}
          </span>
          {!isDragging && (
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
          )}
        </div>
      )}
    </div>
  );
}
