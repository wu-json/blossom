import { useMemo } from "react";
import type { YouTubeTranslation } from "./use-video-translations";

const DEFAULT_DURATION_SECONDS = 5;

export function useActiveTranslation(
  translations: YouTubeTranslation[],
  currentTime: number
): YouTubeTranslation | null {
  return useMemo(() => {
    if (translations.length === 0) return null;

    // Find translation whose range contains current time
    for (const t of translations) {
      const start = t.timestampSeconds;
      const end = start + (t.durationSeconds ?? DEFAULT_DURATION_SECONDS);

      if (currentTime >= start && currentTime <= end) {
        return t;
      }
    }

    // Not within any range - show nothing
    return null;
  }, [translations, currentTime]);
}
