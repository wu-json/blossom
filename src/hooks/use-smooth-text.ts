import { useState, useEffect, useRef } from "react";

const CHARS_PER_FRAME = 3;
const FRAME_INTERVAL = 16; // ~60fps

export function useSmoothText(targetText: string, enabled: boolean): string {
  const [displayedText, setDisplayedText] = useState(targetText);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(targetText);
      currentIndexRef.current = targetText.length;
      return;
    }

    const animate = () => {
      if (currentIndexRef.current < targetText.length) {
        currentIndexRef.current = Math.min(
          currentIndexRef.current + CHARS_PER_FRAME,
          targetText.length
        );
        setDisplayedText(targetText.slice(0, currentIndexRef.current));
        animationRef.current = setTimeout(animate, FRAME_INTERVAL);
      }
    };

    if (currentIndexRef.current < targetText.length) {
      animationRef.current = setTimeout(animate, FRAME_INTERVAL);
    }

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [targetText, enabled]);

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(targetText);
      currentIndexRef.current = targetText.length;
    }
  }, [enabled, targetText]);

  return displayedText;
}
