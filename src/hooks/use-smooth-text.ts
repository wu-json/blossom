import { useState, useEffect, useRef, useCallback } from "react";

// Adaptive velocity configuration
const BASE_CHARS_PER_SECOND = 60;    // Baseline typing speed
const MIN_CHARS_PER_SECOND = 30;     // Minimum speed (prevents stalling)
const MAX_CHARS_PER_SECOND = 400;    // Maximum catch-up speed
const CATCH_UP_FACTOR = 3;           // Acceleration per char behind
const SMOOTHING_FACTOR = 0.15;       // Velocity smoothing (lower = smoother)

export function useSmoothText(targetText: string, enabled: boolean): string {
  const [displayedText, setDisplayedText] = useState(targetText);

  // Animation state in refs to avoid re-renders during animation loop
  const animationFrameRef = useRef<number | null>(null);
  const currentPositionRef = useRef(0);          // Float position for smooth animation
  const currentVelocityRef = useRef(BASE_CHARS_PER_SECOND);
  const lastFrameTimeRef = useRef<number | null>(null);
  const targetLengthRef = useRef(targetText.length);
  const targetTextRef = useRef(targetText);

  // Update refs when targetText changes
  useEffect(() => {
    targetLengthRef.current = targetText.length;
    targetTextRef.current = targetText;
  }, [targetText]);

  const animate = useCallback((timestamp: number) => {
    // Initialize timing on first frame
    if (lastFrameTimeRef.current === null) {
      lastFrameTimeRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // Calculate delta time in seconds
    const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = timestamp;

    const targetLength = targetLengthRef.current;
    const currentPos = currentPositionRef.current;
    const gap = targetLength - currentPos;

    if (gap <= 0) {
      // Caught up - wait for more text
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // Calculate target velocity based on gap (adaptive speed)
    const targetVelocity = Math.min(
      Math.max(
        BASE_CHARS_PER_SECOND + gap * CATCH_UP_FACTOR,
        MIN_CHARS_PER_SECOND
      ),
      MAX_CHARS_PER_SECOND
    );

    // Smooth velocity transition (exponential smoothing)
    currentVelocityRef.current +=
      (targetVelocity - currentVelocityRef.current) * SMOOTHING_FACTOR;

    // Advance position
    const advancement = currentVelocityRef.current * deltaTime;
    const newPosition = Math.min(currentPos + advancement, targetLength);
    currentPositionRef.current = newPosition;

    // Update displayed text only when integer position changes
    const newDisplayIndex = Math.floor(newPosition);
    const currentDisplayIndex = Math.floor(currentPos);

    if (newDisplayIndex !== currentDisplayIndex) {
      setDisplayedText(targetTextRef.current.slice(0, newDisplayIndex));
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // When disabled, immediately show all text
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setDisplayedText(targetText);
      currentPositionRef.current = targetText.length;
      lastFrameTimeRef.current = null;
      return;
    }

    // Start animation if not already running
    if (!animationFrameRef.current) {
      lastFrameTimeRef.current = null;
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, animate, targetText]);

  return displayedText;
}
