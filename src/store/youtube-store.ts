import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TranslationData } from "../types/translation";

export interface YouTubeTranslation {
  id: string;
  videoId: string;
  videoTitle: string | null;
  timestampSeconds: number;
  frameImage: string | null;
  translationData: TranslationData | null;
  createdAt: Date;
}

interface YouTubeState {
  videoUrl: string;
  videoId: string | null;
  videoTitle: string | null;
  isLoading: boolean;
  isExtracting: boolean;
  isTranslating: boolean;
  currentTranslation: TranslationData | null;
  currentTranslationId: string | null;
  currentFrameImage: string | null;
  currentTimestamp: number;
  videoUnavailable: boolean;
  error: string | null;
  // UI preferences (persisted)
  translationBarWidth: number;
  translationBarCollapsed: boolean;
  playerHeight: number; // vh percentage
}

interface YouTubeActions {
  setVideoUrl: (url: string) => void;
  setVideo: (url: string, id: string, title: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setExtracting: (isExtracting: boolean) => void;
  setTranslating: (isTranslating: boolean) => void;
  setCurrentTranslation: (data: TranslationData | null, id?: string | null) => void;
  setCurrentFrameImage: (image: string | null) => void;
  setCurrentTimestamp: (timestamp: number) => void;
  setVideoUnavailable: (unavailable: boolean) => void;
  setError: (error: string | null) => void;
  clearVideo: () => void;
  reset: () => void;
  // UI preferences
  setTranslationBarWidth: (width: number) => void;
  toggleTranslationBarCollapsed: () => void;
  setPlayerHeight: (height: number) => void;
}

export type YouTubeStore = YouTubeState & YouTubeActions;

const initialState: YouTubeState = {
  videoUrl: "",
  videoId: null,
  videoTitle: null,
  isLoading: false,
  isExtracting: false,
  isTranslating: false,
  currentTranslation: null,
  currentTranslationId: null,
  currentFrameImage: null,
  currentTimestamp: 0,
  videoUnavailable: false,
  error: null,
  // UI preferences (persisted)
  translationBarWidth: 35,
  translationBarCollapsed: false,
  playerHeight: 50,
};

export const useYouTubeStore = create<YouTubeStore>()(
  persist(
    (set) => ({
      ...initialState,

      setVideoUrl: (url: string) => set({ videoUrl: url }),

      setVideo: (url: string, id: string, title: string | null) =>
        set({
          videoUrl: url,
          videoId: id,
          videoTitle: title,
          videoUnavailable: false,
          error: null,
        }),

      setLoading: (isLoading: boolean) => set({ isLoading }),

      setExtracting: (isExtracting: boolean) => set({ isExtracting }),

      setTranslating: (isTranslating: boolean) => set({ isTranslating }),

      setCurrentTranslation: (data: TranslationData | null, id?: string | null) =>
        set({
          currentTranslation: data,
          currentTranslationId: id ?? null,
        }),

      setCurrentFrameImage: (image: string | null) => set({ currentFrameImage: image }),

      setCurrentTimestamp: (timestamp: number) => set({ currentTimestamp: timestamp }),

      setVideoUnavailable: (unavailable: boolean) => set({ videoUnavailable: unavailable }),

      setError: (error: string | null) => set({ error }),

      clearVideo: () =>
        set({
          videoId: null,
          videoTitle: null,
          videoUrl: "",
          currentTranslation: null,
          currentTranslationId: null,
          currentFrameImage: null,
          currentTimestamp: 0,
          videoUnavailable: false,
          error: null,
        }),

      reset: () => set(initialState),

      setTranslationBarWidth: (width: number) =>
        set({ translationBarWidth: Math.max(20, Math.min(50, width)) }),

      toggleTranslationBarCollapsed: () =>
        set((state) => ({ translationBarCollapsed: !state.translationBarCollapsed })),

      setPlayerHeight: (height: number) =>
        set({ playerHeight: Math.max(25, Math.min(75, height)) }),
    }),
    {
      name: "blossom-youtube-ui",
      partialize: (state) => ({
        translationBarWidth: state.translationBarWidth,
        translationBarCollapsed: state.translationBarCollapsed,
        playerHeight: state.playerHeight,
      }),
    }
  )
);
