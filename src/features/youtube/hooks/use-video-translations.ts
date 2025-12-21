import { useState, useEffect, useCallback } from "react";
import type { TranslationData } from "../../../types/translation";

export interface YouTubeTranslation {
  id: string;
  videoId: string;
  videoTitle: string | null;
  timestampSeconds: number;
  frameImage: string | null;
  translationData: TranslationData | null;
  createdAt: number;
}

interface UseVideoTranslationsResult {
  translations: YouTubeTranslation[];
  isLoading: boolean;
  addTranslation: (translation: YouTubeTranslation) => void;
  updateTranslationTimestamp: (id: string, newTimestamp: number) => void;
  refetch: () => Promise<void>;
}

export function useVideoTranslations(videoId: string | null): UseVideoTranslationsResult {
  const [translations, setTranslations] = useState<YouTubeTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTranslations = useCallback(async () => {
    if (!videoId) {
      setTranslations([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/youtube/translations?videoId=${videoId}`);
      const data = await response.json();
      setTranslations(data.translations);
    } catch (error) {
      console.error("Failed to fetch translations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const addTranslation = useCallback((translation: YouTubeTranslation) => {
    setTranslations((prev) =>
      [...prev, translation].sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    );
  }, []);

  const updateTranslationTimestamp = useCallback(
    (id: string, newTimestamp: number) => {
      // Optimistic update - update local state immediately and re-sort
      setTranslations((prev) =>
        prev
          .map((t) => (t.id === id ? { ...t, timestampSeconds: newTimestamp } : t))
          .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
      );

      // Persist to database
      fetch(`/api/youtube/translations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestampSeconds: newTimestamp }),
      }).catch((error) => {
        console.error("Failed to update translation timestamp:", error);
        // Rollback on failure
        fetchTranslations();
      });
    },
    [fetchTranslations]
  );

  return {
    translations,
    isLoading,
    addTranslation,
    updateTranslationTimestamp,
    refetch: fetchTranslations,
  };
}
