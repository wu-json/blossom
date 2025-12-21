import { useState, useRef, useCallback, useEffect } from "react";

const DRAG_THRESHOLD_PX = 5;
const HOLD_THRESHOLD_MS = 150;

interface UseDraggableMarkerOptions {
  initialPosition: number; // percentage 0-100
  trackRef: React.RefObject<HTMLDivElement | null>;
  videoDuration: number;
  onDragEnd: (newTimestamp: number) => void;
  onNavigate: () => void;
  disabled?: boolean;
}

interface UseDraggableMarkerResult {
  isDragging: boolean;
  markerRef: React.RefObject<HTMLDivElement | null>;
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
}

export function useDraggableMarker({
  initialPosition,
  trackRef,
  videoDuration,
  onDragEnd,
  onNavigate,
  disabled = false,
}: UseDraggableMarkerOptions): UseDraggableMarkerResult {
  const [isDragging, setIsDragging] = useState(false);
  const markerRef = useRef<HTMLDivElement | null>(null);

  const startXRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentPositionRef = useRef(initialPosition);
  const hasDraggedRef = useRef(false);

  // Sync position ref with initialPosition when not dragging
  useEffect(() => {
    if (!isDragging) {
      currentPositionRef.current = initialPosition;
    }
  }, [initialPosition, isDragging]);

  const calculatePositionFromX = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return currentPositionRef.current;

      const rect = trackRef.current.getBoundingClientRect();
      const newPosition = ((clientX - rect.left) / rect.width) * 100;
      return Math.max(0, Math.min(100, newPosition));
    },
    [trackRef]
  );

  // Update marker position directly via DOM (no React re-render)
  const updateMarkerPosition = useCallback((position: number) => {
    if (markerRef.current) {
      markerRef.current.style.left = `${position}%`;
    }
    currentPositionRef.current = position;
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const deltaX = Math.abs(e.clientX - startXRef.current);

      // Start dragging if moved beyond threshold
      if (!hasDraggedRef.current && deltaX > DRAG_THRESHOLD_PX) {
        hasDraggedRef.current = true;
        setIsDragging(true);
      }

      if (hasDraggedRef.current) {
        const newPosition = calculatePositionFromX(e.clientX);
        updateMarkerPosition(newPosition);
      }
    },
    [calculatePositionFromX, updateMarkerPosition]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      const elapsed = Date.now() - startTimeRef.current;
      const deltaX = Math.abs(e.clientX - startXRef.current);

      // If didn't drag and was a quick click, navigate
      if (!hasDraggedRef.current && elapsed < HOLD_THRESHOLD_MS && deltaX < DRAG_THRESHOLD_PX) {
        onNavigate();
      } else if (hasDraggedRef.current) {
        // Dragged - save new position
        const newPosition = calculatePositionFromX(e.clientX);
        const newTimestamp = (newPosition / 100) * videoDuration;
        onDragEnd(newTimestamp);
      }

      setIsDragging(false);
      hasDraggedRef.current = false;

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    },
    [calculatePositionFromX, onNavigate, onDragEnd, videoDuration, handleMouseMove]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      startXRef.current = e.clientX;
      startTimeRef.current = Date.now();
      hasDraggedRef.current = false;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [disabled, handleMouseMove, handleMouseUp]
  );

  // Touch support
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = Math.abs(touch.clientX - startXRef.current);

      if (!hasDraggedRef.current && deltaX > DRAG_THRESHOLD_PX) {
        hasDraggedRef.current = true;
        setIsDragging(true);
      }

      if (hasDraggedRef.current) {
        e.preventDefault();
        const newPosition = calculatePositionFromX(touch.clientX);
        updateMarkerPosition(newPosition);
      }
    },
    [calculatePositionFromX, updateMarkerPosition]
  );

  const handleTouchEnd = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;

    if (!hasDraggedRef.current && elapsed < HOLD_THRESHOLD_MS) {
      onNavigate();
    } else if (hasDraggedRef.current) {
      const newTimestamp = (currentPositionRef.current / 100) * videoDuration;
      onDragEnd(newTimestamp);
    }

    setIsDragging(false);
    hasDraggedRef.current = false;

    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
  }, [onNavigate, onDragEnd, videoDuration, handleTouchMove]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      e.stopPropagation();

      const touch = e.touches[0];
      if (!touch) return;

      startXRef.current = touch.clientX;
      startTimeRef.current = Date.now();
      hasDraggedRef.current = false;

      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
    },
    [disabled, handleTouchMove, handleTouchEnd]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return {
    isDragging,
    markerRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
    },
  };
}
