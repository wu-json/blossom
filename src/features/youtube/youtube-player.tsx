import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

// YouTube IFrame API types
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: YTPlayerOptions
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
  }
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: {
    enablejsapi?: number;
    origin?: string;
    autoplay?: number;
  };
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getVideoData: () => { title: string; author: string; video_id: string };
  destroy: () => void;
}

export interface YouTubePlayerRef {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  pauseVideo: () => void;
}

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (videoData: { title: string; author: string }) => void;
  onError?: (errorCode: number) => void;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, onReady, onError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      seekTo: (seconds: number) =>
        playerRef.current?.seekTo(seconds, true),
      pauseVideo: () => playerRef.current?.pauseVideo(),
    }));

    useEffect(() => {
      let isDestroyed = false;

      const initPlayer = () => {
        if (isDestroyed || !containerRef.current || !window.YT) return;

        // Destroy existing player if any
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (isDestroyed) return;
              const videoData = event.target.getVideoData();
              onReady?.({
                title: videoData.title,
                author: videoData.author,
              });
            },
            onError: (event) => {
              if (isDestroyed) return;
              onError?.(event.data);
            },
          },
        });
      };

      // Check if API is already loaded
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        // Load YouTube IFrame API
        const existingScript = document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );

        if (!existingScript) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
        }

        // Queue initialization
        const previousCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          previousCallback?.();
          initPlayer();
        };
      }

      return () => {
        isDestroyed = true;
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }, [videoId, onReady, onError]);

    return (
      <div
        ref={containerRef}
        className="w-full aspect-video bg-black rounded-lg"
      />
    );
  }
);
