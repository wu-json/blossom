import { useRef, useEffect } from "react";
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
  isExpanded: boolean;
  trackRef: React.RefObject<HTMLDivElement | null>;
  videoDuration: number;
  onNavigate: () => void;
  onDragStart: () => void;
  onDragEnd: (newTimestamp: number) => void;
}

export function TimelineMarker({
  translation,
  position: initialPosition,
  isActive,
  isExpanded,
  trackRef,
  videoDuration,
  onNavigate,
  onDragStart,
  onDragEnd,
}: TimelineMarkerProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewTimeRef = useRef<HTMLSpanElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const { markerRef, handlers } = useDraggableMarker({
    initialPosition,
    trackRef,
    videoDuration,
    onNavigate,
    onDragStart: () => {
      // Show preview via DOM, not React state
      if (previewRef.current) {
        previewRef.current.style.display = "block";
      }
      // Start RAF loop for time updates
      const updateTime = () => {
        if (!markerRef.current || !previewTimeRef.current) return;
        const leftStr = markerRef.current.style.left;
        const position = parseFloat(leftStr) || initialPosition;
        const timestamp = (position / 100) * videoDuration;
        previewTimeRef.current.textContent = formatTime(timestamp);
        rafIdRef.current = requestAnimationFrame(updateTime);
      };
      rafIdRef.current = requestAnimationFrame(updateTime);
      onDragStart();
    },
    onDragEnd: (newTimestamp) => {
      // Hide preview via DOM
      if (previewRef.current) {
        previewRef.current.style.display = "none";
      }
      // Stop RAF loop
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      onDragEnd(newTimestamp);
    },
  });

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Show/hide preview on hover via DOM
  const handleMouseEnter = () => {
    if (previewRef.current && isExpanded) {
      previewRef.current.style.display = "block";
    }
  };

  const handleMouseLeave = () => {
    // Only hide if not dragging (check via class)
    if (previewRef.current && !markerRef.current?.classList.contains("is-dragging")) {
      previewRef.current.style.display = "none";
    }
  };

  // Rhombus size based on state
  const size = isExpanded ? 10 : 6;

  return (
    <div
      ref={markerRef}
      className="timeline-marker"
      style={{
        position: "absolute",
        top: "50%",
        left: `${initialPosition}%`,
        transform: "translate(-50%, -50%)",
        zIndex: isActive ? 2 : 1,
        cursor: "grab",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...handlers}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "20px",
          height: isExpanded ? "32px" : "16px",
        }}
      />

      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          transform: "rotate(45deg)",
          backgroundColor: isActive ? "var(--primary)" : "rgba(255, 255, 255, 0.5)",
          transition: "all 0.15s ease-out",
          boxShadow: isActive ? "0 0 8px var(--primary)" : "none",
        }}
      />

      <div
        ref={previewRef}
        className="marker-preview"
        style={{
          display: "none",
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: "8px",
          padding: "6px 10px",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
          fontSize: "11px",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <span
          ref={previewTimeRef}
          style={{
            color: "var(--text-muted)",
            marginRight: "6px",
          }}
        >
          {formatTime((initialPosition / 100) * videoDuration)}
        </span>
        <span
          style={{
            color: "var(--text)",
            maxWidth: "180px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "inline-block",
            verticalAlign: "bottom",
          }}
        >
          {translation.translationData?.originalText || "Translation"}
        </span>
      </div>
    </div>
  );
}
