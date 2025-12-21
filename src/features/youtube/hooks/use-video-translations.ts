import { useState, useEffect, useCallback } from "react";
import type { TranslationData } from "../../../types/translation";

export interface YouTubeTranslation {
  id: string;
  videoId: string;
  videoTitle: string | null;
  timestampSeconds: number;
  durationSeconds: number;
  frameImage: string | null;
  translationData: TranslationData | null;
  createdAt: number;
}

interface UseVideoTranslationsResult {
  translations: YouTubeTranslation[];
  isLoading: boolean;
  addTranslation: (translation: YouTubeTranslation) => void;
  updateDuration: (translationId: string, durationSeconds: number) => void;
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

  const updateDuration = useCallback(async (translationId: string, durationSeconds: number) => {
    // Optimistic update
    setTranslations((prev) =>
      prev.map((t) => (t.id === translationId ? { ...t, durationSeconds } : t))
    );

    // Persist to server
    try {
      await fetch(`/api/youtube/translations/${translationId}/duration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
    } catch (error) {
      console.error("Failed to update duration:", error);
      // Refetch to restore correct state on error
      fetchTranslations();
    }
  }, [fetchTranslations]);

  return {
    translations,
    isLoading,
    addTranslation,
    updateDuration,
    refetch: fetchTranslations,
  };
}
