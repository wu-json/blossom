import { useMemo } from "react";
import type { YouTubeTranslation } from "./use-video-translations";

export function useActiveTranslation(
  translations: YouTubeTranslation[],
  currentTime: number
): YouTubeTranslation | null {
  return useMemo(() => {
    if (translations.length === 0) return null;

    // Find the latest translation that is at or before the current time
    // Translations are sorted by timestampSeconds ASC
    let active: YouTubeTranslation | null = null;
    for (const t of translations) {
      if (t.timestampSeconds <= currentTime) {
        active = t;
      } else {
        break; // Past current time, no need to continue
      }
    }

    return active;
  }, [translations, currentTime]);
}
