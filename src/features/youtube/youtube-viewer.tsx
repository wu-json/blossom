import { useEffect, useRef, useState, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { Loader2, Languages, AlertCircle, ExternalLink, X, Share2, Check, Play, Pause, Volume2, VolumeX, Maximize, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useYouTubeStore } from "../../store/youtube-store";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import { TranslationCard, TranslationSkeleton, StreamingTranslationCard } from "../../components/translation-card";
import { parseTranslationContent, hasTranslationMarkers, parseStreamingTranslation } from "../../lib/parse-translation";
import { TranslationTimeline } from "./translation-timeline";
import { useVideoTranslations, type YouTubeTranslation } from "./hooks/use-video-translations";
import { useActiveTranslation } from "./hooks/use-active-translation";
import { MenuIcon } from "../../components/icons/menu-icon";
import { HeaderControls } from "../../components/ui/header-controls";
import { version } from "../../generated/version";
import { RecentVideosGrid } from "./recent-videos-grid";
import type { TranslationData, WordBreakdown, PartialTranslationData } from "../../types/translation";
import type { Language } from "../../types/chat";

const translations: Record<Language, { title: string; description: string; placeholder: string; load: string; translate: string; extracting: string; translating: string; share: string; copied: string }> = {
  ja: {
    title: "YouTube翻訳",
    description: "YouTube動画のフレームからテキストを翻訳",
    placeholder: "YouTube URLを貼り付け...",
    load: "読込",
    translate: "翻訳",
    extracting: "抽出中...",
    translating: "翻訳中...",
    share: "共有",
    copied: "コピー済",
  },
  zh: {
    title: "YouTube翻译",
    description: "翻译YouTube视频帧中的文字",
    placeholder: "粘贴YouTube链接...",
    load: "加载",
    translate: "翻译",
    extracting: "提取中...",
    translating: "翻译中...",
    share: "分享",
    copied: "已复制",
  },
  ko: {
    title: "YouTube 번역",
    description: "YouTube 동영상 프레임에서 텍스트 번역",
    placeholder: "YouTube URL 붙여넣기...",
    load: "로드",
    translate: "번역",
    extracting: "추출 중...",
    translating: "번역 중...",
    share: "공유",
    copied: "복사됨",
  },
};

function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/v\/([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement | string,
        config: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
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
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getVideoData: () => { title: string; author: string; video_id: string };
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  getIframe: () => HTMLIFrameElement;
  destroy: () => void;
}

interface YouTubeTranslationRecord {
  id: string;
  video_id: string;
  video_title: string | null;
  timestamp_seconds: number;
  frame_image: string | null;
  translation_data: TranslationData | null;
  created_at: number;
}

export function YouTubeViewer() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(searchString);
  const translationId = params.get("tid");
  const urlVideoId = params.get("v");
  const urlTimestamp = params.get("t");

  const {
    videoUrl,
    videoId,
    videoTitle,
    isExtracting,
    isTranslating,
    currentTranslation,
    currentTranslationId,
    currentFrameImage,
    currentTimestamp,
    videoUnavailable,
    error,
    translationBarWidth,
    translationBarCollapsed,
    setVideoUrl,
    setVideo,
    setExtracting,
    setTranslating,
    setCurrentTranslation,
    setCurrentFrameImage,
    setCurrentTimestamp,
    setVideoUnavailable,
    setError,
    clearVideo,
    setTranslationBarWidth,
    toggleTranslationBarCollapsed,
  } = useYouTubeStore();

  const language = useChatStore((state) => state.language);
  const toggleSidebar = useChatStore((state) => state.toggleSidebar);
  const sidebarCollapsed = useChatStore((state) => state.sidebarCollapsed);
  const { navigateToMeadow } = useNavigation();

  const [inputUrl, setInputUrl] = useState(videoUrl);
  const [playerReady, setPlayerReady] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [savedWords, setSavedWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [timelineSavedWords, setTimelineSavedWords] = useState<Record<string, string[]>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const apiLoadedRef = useRef(false);
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const {
    translations: videoTranslations,
    addTranslation,
    updateTranslationTimestamp,
    refetch: refetchTranslations,
  } = useVideoTranslations(videoId);
  const timelineActiveTranslation = useActiveTranslation(videoTranslations, currentPlaybackTime);

  useEffect(() => {
    if (apiLoadedRef.current) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    apiLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (translationId) {
      fetchTranslationRecord(translationId);
    }
  }, [translationId]);

  useEffect(() => {
    if (urlVideoId && !translationId && urlVideoId !== videoId) {
      const url = `https://www.youtube.com/watch?v=${urlVideoId}`;
      setVideo(url, urlVideoId, null);
      setInputUrl(url);
      setCurrentTranslation(null);
      setCurrentFrameImage(null);
      setError(null);
      setSavedWords([]);
    }
  }, [urlVideoId, translationId]);

  useEffect(() => {
    if (urlVideoId && !translationId && urlTimestamp) {
      const timestamp = parseFloat(urlTimestamp);
      setCurrentTimestamp(timestamp);
      if (playerReady && playerRef.current) {
        playerRef.current.seekTo(timestamp, true);
      }
    }
  }, [urlVideoId, urlTimestamp, translationId, playerReady]);

  const fetchTranslationRecord = async (id: string) => {
    try {
      const response = await fetch(`/api/youtube/translations/${id}`);
      if (!response.ok) {
        setError("Translation not found");
        return;
      }
      const data: YouTubeTranslationRecord = await response.json();

      // Set up the video
      setVideo(
        `https://www.youtube.com/watch?v=${data.video_id}`,
        data.video_id,
        data.video_title
      );
      setInputUrl(`https://www.youtube.com/watch?v=${data.video_id}`);
      setCurrentTimestamp(data.timestamp_seconds);

      if (data.translation_data) {
        setCurrentTranslation(data.translation_data, id);
      }
      if (data.frame_image) {
        setCurrentFrameImage(data.frame_image);
      }
    } catch (err) {
      setError("Failed to load translation");
    }
  };

  // Initialize player when videoId changes
  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
      setPlayerReady(false);
    }

    const initPlayer = () => {
      if (!window.YT || !containerRef.current) return;

      containerRef.current.innerHTML = "";
      const playerDiv = document.createElement("div");
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            setPlayerReady(true);
            const data = event.target.getVideoData();
            if (data.title && !videoTitle) {
              setVideo(videoUrl, videoId, data.title);
            }

            const duration = event.target.getDuration();
            setVideoDuration(duration);

            if (currentTimestamp > 0) {
              event.target.seekTo(currentTimestamp, true);
            }

            fetch("/api/youtube/precache-stream", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ videoId }),
            }).catch(() => {});
          },
          onError: (event) => {
            if ([100, 101, 150].includes(event.data)) {
              setVideoUnavailable(true);
            }
          },
          onStateChange: (event) => {
            setIsPlaying(event.data === 1);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    const interval = setInterval(() => {
      const time = playerRef.current?.getCurrentTime() ?? 0;
      setCurrentPlaybackTime(time);
    }, 250);

    return () => clearInterval(interval);
  }, [playerReady]);

  useEffect(() => {
    if (!playerReady) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (playerRef.current) {
          const state = playerRef.current.getPlayerState();
          if (state === 1) {
            playerRef.current.pauseVideo();
          } else {
            playerRef.current.playVideo();
          }
        }
      }

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (playerReady && !isExtracting && !isTranslating) {
          handleTranslateFrame();
        }
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const currentTime = playerRef.current?.getCurrentTime() ?? 0;
        const seekAmount = 5;

        if (e.key === "ArrowRight") {
          playerRef.current?.seekTo(currentTime + seekAmount, true);
        } else {
          playerRef.current?.seekTo(Math.max(0, currentTime - seekAmount), true);
        }
      }

      if (e.key === "[") {
        e.preventDefault();
        toggleTranslationBarCollapsed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playerReady, isExtracting, isTranslating, toggleTranslationBarCollapsed]);

  const togglePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!playerRef.current) return;
    playerRef.current.setVolume(newVolume);
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!playerRef.current) return;
    const iframe = playerRef.current.getIframe();
    if (iframe.requestFullscreen) {
      iframe.requestFullscreen();
    }
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current || !layoutContainerRef.current) return;

      const containerRect = layoutContainerRef.current.getBoundingClientRect();
      const newWidth = ((containerRect.right - moveEvent.clientX) / containerRect.width) * 100;
      const clampedWidth = Math.max(20, Math.min(50, newWidth));
      setTranslationBarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [setTranslationBarWidth]);

  const handleLoadVideo = () => {
    const id = parseYouTubeUrl(inputUrl);
    if (id) {
      setVideo(inputUrl, id, null);
      setCurrentTranslation(null);
      setCurrentFrameImage(null);
      setCurrentTimestamp(0);
      setError(null);
      setSavedWords([]);
      // Update URL to shareable format
      setLocation(`/youtube?v=${id}`);
    } else {
      setError("Invalid YouTube URL");
    }
  };

  const handleTranslateFrame = async () => {
    if (!videoId || !playerRef.current) return;

    const timestamp = playerRef.current.getCurrentTime();
    setCurrentTimestamp(timestamp);
    setExtracting(true);
    setError(null);
    setStreamingContent("");
    setCurrentTranslation(null);
    setSavedWords([]);

    let frameFilename: string | null = null;

    try {
      const extractResponse = await fetch("/api/youtube/extract-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, timestamp }),
      });

      if (!extractResponse.ok) {
        const data = await extractResponse.json();
        throw new Error(data.error || "Failed to extract frame");
      }

      const extractData = await extractResponse.json();
      frameFilename = extractData.filename;
      setExtracting(false);
      setTranslating(true);

      const translateResponse = await fetch("/api/youtube/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: frameFilename, language }),
      });

      if (!translateResponse.ok) {
        const data = await translateResponse.json();
        throw new Error(data.error || "Failed to translate");
      }

      const reader = translateResponse.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                fullContent += parsed.delta.text;
                setStreamingContent(fullContent);
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }

      const parsedContent = parseTranslationContent(fullContent);
      if (parsedContent.type === "translation") {
        const saveResponse = await fetch("/api/youtube/translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            videoTitle,
            timestampSeconds: timestamp,
            frameFilename,
            translationData: parsedContent.data,
          }),
        });

        if (saveResponse.ok) {
          const savedTranslation = await saveResponse.json();
          setCurrentTranslation(parsedContent.data, savedTranslation.id);

          addTranslation({
            id: savedTranslation.id,
            videoId: videoId!,
            videoTitle: videoTitle,
            timestampSeconds: timestamp,
            frameImage: frameFilename ? `/api/youtube/frames/${frameFilename}` : null,
            translationData: parsedContent.data,
            createdAt: Date.now(),
          });
        } else {
          setCurrentTranslation(parsedContent.data, null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setExtracting(false);
      setTranslating(false);
    }
  };

  const handleSaveWord = async (word: WordBreakdown): Promise<boolean> => {
    if (!currentTranslationId) return false;

    try {
      const response = await fetch("/api/petals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.word,
          reading: word.reading,
          meaning: word.meaning,
          partOfSpeech: word.partOfSpeech,
          language,
          conversationId: `youtube-${videoId}`,
          messageId: currentTranslationId,
          userInput: `From YouTube: ${videoTitle || videoId} at ${formatTimestamp(currentTimestamp)}`,
          sourceType: "youtube",
          youtubeTranslationId: currentTranslationId,
        }),
      });

      if (response.ok) {
        setSavedWords((prev) => [...prev, word.word]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleRemoveWord = async (word: string): Promise<boolean> => {
    if (!currentTranslationId) return false;

    try {
      const response = await fetch(
        `/api/petals/message/${currentTranslationId}/word/${encodeURIComponent(word)}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setSavedWords((prev) => prev.filter((w) => w !== word));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleViewFlower = (word: string) => {
    navigateToMeadow(word);
  };

  const handleTimelineMarkerClick = useCallback((translation: YouTubeTranslation) => {
    playerRef.current?.seekTo(translation.timestampSeconds, true);
  }, []);

  const handleTimelineSeek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const handleTimelineSaveWord = useCallback(async (translationId: string, word: WordBreakdown): Promise<boolean> => {
    const translation = videoTranslations.find(t => t.id === translationId);
    if (!translation) return false;

    try {
      const response = await fetch("/api/petals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.word,
          reading: word.reading,
          meaning: word.meaning,
          partOfSpeech: word.partOfSpeech,
          language,
          conversationId: `youtube-${videoId}`,
          messageId: translationId,
          userInput: `From YouTube: ${translation.videoTitle || videoId} at ${formatTimestamp(translation.timestampSeconds)}`,
          sourceType: "youtube",
          youtubeTranslationId: translationId,
        }),
      });

      if (response.ok) {
        setTimelineSavedWords((prev) => ({
          ...prev,
          [translationId]: [...(prev[translationId] || []), word.word],
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [videoTranslations, language, videoId]);

  const handleTimelineRemoveWord = useCallback(async (translationId: string, word: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/petals/message/${translationId}/word/${encodeURIComponent(word)}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setTimelineSavedWords((prev) => ({
          ...prev,
          [translationId]: (prev[translationId] || []).filter((w) => w !== word),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const renderTranslationContent = () => {
    if (currentTranslation) {
      return (
        <TranslationCard
          data={currentTranslation}
          onSaveWord={currentTranslationId ? handleSaveWord : undefined}
          onRemoveWord={currentTranslationId ? handleRemoveWord : undefined}
          onViewFlower={currentTranslationId ? handleViewFlower : undefined}
          savedWords={savedWords}
        />
      );
    }

    if (!streamingContent) return <TranslationSkeleton />;

    const markers = hasTranslationMarkers(streamingContent);

    if (markers.isStarting) {
      return <TranslationSkeleton />;
    }

    if (markers.hasStart) {
      // Check if complete
      if (markers.hasEnd) {
        const parsed = parseTranslationContent(streamingContent);
        if (parsed.type === "translation") {
          return (
            <TranslationCard
              data={parsed.data}
              onSaveWord={currentTranslationId ? handleSaveWord : undefined}
              onRemoveWord={currentTranslationId ? handleRemoveWord : undefined}
              onViewFlower={currentTranslationId ? handleViewFlower : undefined}
              savedWords={savedWords}
            />
          );
        }
      }
      const partialData = parseStreamingTranslation(streamingContent);
      if (partialData && hasAnyContent(partialData)) {
        return <StreamingTranslationCard data={partialData} />;
      }
    }

    return <TranslationSkeleton />;
  };

  function hasAnyContent(data: PartialTranslationData): boolean {
    return !!(
      data.originalText ||
      data.subtext ||
      data.translation ||
      (data.breakdown && data.breakdown.length > 0) ||
      data.grammarNotes
    );
  }

  const handleClearVideo = () => {
    clearVideo();
    setInputUrl("");
    setPlayerReady(false);
    setSavedWords([]);
    // Clear URL params
    setLocation("/youtube");
  };

  const handleShare = async () => {
    if (!videoId || !playerRef.current) return;

    const timestamp = playerRef.current.getCurrentTime();
    const shareUrl = `${window.location.origin}/youtube?v=${videoId}&t=${Math.floor(timestamp)}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback - open share URL in alert
      prompt("Copy this link:", shareUrl);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-auto relative">
        {error && (
          <div className="max-w-3xl mx-auto px-6 pt-4">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#EF4444",
              }}
            >
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {videoId && (
          <div ref={layoutContainerRef} className="flex flex-col lg:flex-row h-full overflow-hidden">
            {videoUnavailable && currentFrameImage ? (
              <div className="max-w-3xl mx-auto px-6 py-4 space-y-4">
                <div
                  className="flex flex-col items-center gap-4 p-6 rounded-xl"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <AlertCircle size={32} style={{ color: "var(--text-muted)" }} />
                  <div className="text-center">
                    <h3 className="font-medium" style={{ color: "var(--text)" }}>
                      Video Unavailable
                    </h3>
                    <p
                      className="text-sm mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      This video is no longer available on YouTube.
                    </p>
                  </div>
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: "var(--primary)" }}
                  >
                    Try on YouTube <ExternalLink size={14} />
                  </a>
                </div>
                <div className="relative">
                  <img
                    src={currentFrameImage}
                    alt="Cached video frame"
                    className="w-full rounded-xl"
                  />
                  <div
                    className="absolute bottom-3 right-3 px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      color: "white",
                    }}
                  >
                    {formatTimestamp(currentTimestamp)}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col min-w-0 lg:flex-shrink-0 transition-all duration-200"
                style={{
                  width: translationBarCollapsed ? "100%" : undefined,
                  flex: translationBarCollapsed ? undefined : `0 0 ${100 - translationBarWidth}%`,
                }}
              >
                {!videoUnavailable && (
                  <div
                    className="flex items-center gap-3 px-4 py-2 border-b flex-shrink-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <button
                      onClick={handleClearVideo}
                      className="p-1 rounded transition-all hover:opacity-70 flex-shrink-0"
                      style={{ color: "var(--text-muted)" }}
                      title="Close video"
                    >
                      <X size={18} />
                    </button>
                    {videoTitle && (
                      <h2
                        className="flex-1 text-sm font-medium truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {videoTitle}
                      </h2>
                    )}
                    {playerReady && (
                      <>
                        <button
                          onClick={handleShare}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-80 flex-shrink-0"
                          style={{
                            backgroundColor: "var(--surface)",
                            color: copied ? "var(--primary)" : "var(--text-muted)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {copied ? <Check size={14} /> : <Share2 size={14} />}
                          {copied ? translations[language].copied : translations[language].share}
                        </button>
                        <button
                          onClick={handleTranslateFrame}
                          disabled={isExtracting || isTranslating}
                          className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                          style={{
                            backgroundColor: "var(--primary)",
                            color: "white",
                          }}
                        >
                          {isExtracting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              {translations[language].extracting}
                            </>
                          ) : isTranslating ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              {translations[language].translating}
                            </>
                          ) : (
                            <>
                              <Languages size={14} />
                              {translations[language].translate}
                              <kbd
                                className="ml-1 px-1.5 py-0.5 rounded text-xs"
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  fontFamily: "inherit",
                                }}
                              >
                                ⌘↵
                              </kbd>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div
                  ref={containerRef}
                  className="w-full aspect-video flex-shrink-0 max-h-[50vh] lg:max-h-[55vh]"
                  style={{ backgroundColor: "var(--surface)" }}
                />

                {playerReady && videoDuration > 0 && (
                  <div
                    className="flex flex-col gap-2 px-4 py-3"
                    style={{
                      backgroundColor: "var(--surface)",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={togglePlayPause}
                        className="p-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ color: "var(--text-muted)" }}
                        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                      >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                      </button>

                      <span
                        className="text-sm font-medium tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatTimestamp(currentPlaybackTime)} / {formatTimestamp(videoDuration)}
                      </span>

                      <div className="flex-1" />

                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMute}
                          className="p-1.5 rounded-lg transition-all hover:opacity-80"
                          style={{ color: "var(--text-muted)" }}
                          title={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-20 h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{
                            backgroundColor: "var(--border)",
                            accentColor: "var(--primary)",
                          }}
                        />
                      </div>

                      <button
                        onClick={toggleFullscreen}
                        className="p-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ color: "var(--text-muted)" }}
                        title="Fullscreen"
                      >
                        <Maximize size={18} />
                      </button>
                    </div>

                    {videoTranslations.length > 0 ? (
                      <TranslationTimeline
                        videoDuration={videoDuration}
                        currentTime={currentPlaybackTime}
                        translations={videoTranslations}
                        activeTranslationId={timelineActiveTranslation?.id ?? null}
                        onMarkerClick={handleTimelineMarkerClick}
                        onSeek={handleTimelineSeek}
                        onMarkerDrag={updateTranslationTimestamp}
                      />
                    ) : (
                      <div
                        className="relative h-2 rounded-full cursor-pointer"
                        style={{ backgroundColor: "var(--border)" }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const percent = (e.clientX - rect.left) / rect.width;
                          handleTimelineSeek(percent * videoDuration);
                        }}
                      >
                        <div
                          className="absolute left-0 top-0 h-full rounded-full"
                          style={{
                            width: `${(currentPlaybackTime / videoDuration) * 100}%`,
                            backgroundColor: "var(--primary)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Translation history list - visible on wide screens */}
                {videoTranslations.length > 0 && (
                  <div className="hidden lg:flex flex-1 flex-col overflow-hidden">
                    <div
                      className="flex-1 overflow-auto px-4 py-3"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <div className="space-y-2">
                        {videoTranslations.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleTimelineMarkerClick(t)}
                            className="w-full text-left px-3 py-2 rounded-lg transition-all hover:opacity-80"
                            style={{
                              backgroundColor: timelineActiveTranslation?.id === t.id
                                ? "var(--primary)"
                                : "var(--surface)",
                              color: timelineActiveTranslation?.id === t.id
                                ? "white"
                                : "var(--text)",
                              border: `1px solid ${timelineActiveTranslation?.id === t.id ? "var(--primary)" : "var(--border)"}`,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs font-medium tabular-nums px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: timelineActiveTranslation?.id === t.id
                                    ? "rgba(255,255,255,0.2)"
                                    : "var(--border)",
                                }}
                              >
                                {formatTimestamp(t.timestampSeconds)}
                              </span>
                              <span className="text-sm truncate flex-1">
                                {t.translationData?.originalText || "Translation"}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resize handle - only visible on large screens when not collapsed */}
            {!translationBarCollapsed && (
              <div
                className="hidden lg:flex items-center justify-center flex-shrink-0 group"
                style={{
                  width: "6px",
                  cursor: "col-resize",
                  backgroundColor: isResizing ? "var(--primary)" : "transparent",
                  transition: isResizing ? "none" : "background-color 0.15s",
                }}
                onMouseDown={handleResizeStart}
              >
                <div
                  className="w-[2px] h-8 rounded-full transition-colors group-hover:opacity-100"
                  style={{
                    backgroundColor: isResizing ? "var(--primary)" : "var(--border)",
                    opacity: isResizing ? 1 : 0.5,
                  }}
                />
              </div>
            )}

            {/* Collapse/expand button when sidebar is collapsed */}
            {translationBarCollapsed && (
              <button
                onClick={toggleTranslationBarCollapsed}
                className="hidden lg:flex items-center justify-center flex-shrink-0 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  width: "24px",
                  borderLeft: "1px solid var(--border)",
                }}
                title="Expand sidebar ([)"
              >
                <PanelRightOpen size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            )}

            {/* Translation bar content */}
            {!translationBarCollapsed && (
              (isTranslating || timelineActiveTranslation?.translationData) ? (
                <div
                  className="hidden lg:flex flex-col min-w-0 overflow-auto transition-all duration-200"
                  style={{
                    flex: `0 0 ${translationBarWidth}%`,
                    borderLeft: "1px solid var(--border)",
                  }}
                >
                  {/* Collapse button header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <button
                      onClick={toggleTranslationBarCollapsed}
                      className="flex items-center gap-1.5 p-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      title="Collapse sidebar ([)"
                    >
                      <PanelRightClose size={14} style={{ color: "var(--text-muted)" }} />
                      <kbd
                        className="text-[10px] px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: "var(--surface)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        [
                      </kbd>
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto px-4 pt-4 pb-8">
                    <div
                      className="rounded-xl px-4 py-4"
                      style={{
                        backgroundColor: "var(--assistant-bubble)",
                        color: "var(--assistant-bubble-text)",
                      }}
                    >
                      {isTranslating ? (
                        renderTranslationContent()
                      ) : timelineActiveTranslation?.translationData ? (
                        <TranslationCard
                          data={timelineActiveTranslation.translationData}
                          onSaveWord={(word) => handleTimelineSaveWord(timelineActiveTranslation.id, word)}
                          onRemoveWord={(word) => handleTimelineRemoveWord(timelineActiveTranslation.id, word)}
                          onViewFlower={handleViewFlower}
                          savedWords={timelineSavedWords[timelineActiveTranslation.id] || []}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="hidden lg:flex flex-col min-w-0 transition-all duration-200"
                  style={{
                    flex: `0 0 ${translationBarWidth}%`,
                    borderLeft: "1px solid var(--border)",
                  }}
                >
                  {/* Collapse button header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <button
                      onClick={toggleTranslationBarCollapsed}
                      className="flex items-center gap-1.5 p-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      title="Collapse sidebar ([)"
                    >
                      <PanelRightClose size={14} style={{ color: "var(--text-muted)" }} />
                      <kbd
                        className="text-[10px] px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: "var(--surface)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        [
                      </kbd>
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <Languages size={32} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                    <p
                      className="mt-3 text-sm text-center px-4"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {translations[language].translate} (⌘↵)
                    </p>
                  </div>
                </div>
              )
            )}

            {/* Mobile translation view - always full width on small screens */}
            {(isTranslating || timelineActiveTranslation?.translationData) && (
              <div className="lg:hidden flex-1 min-w-0 overflow-auto px-4 pt-4 pb-8">
                <div
                  className="rounded-xl px-4 py-4"
                  style={{
                    backgroundColor: "var(--assistant-bubble)",
                    color: "var(--assistant-bubble-text)",
                  }}
                >
                  {isTranslating ? (
                    renderTranslationContent()
                  ) : timelineActiveTranslation?.translationData ? (
                    <TranslationCard
                      data={timelineActiveTranslation.translationData}
                      onSaveWord={(word) => handleTimelineSaveWord(timelineActiveTranslation.id, word)}
                      onRemoveWord={(word) => handleTimelineRemoveWord(timelineActiveTranslation.id, word)}
                      onViewFlower={handleViewFlower}
                      savedWords={timelineSavedWords[timelineActiveTranslation.id] || []}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {!videoId && (
          <div className="flex flex-col h-full">
            <header
              className="sticky top-0 z-10 border-b"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              <div className="px-4 py-3 flex items-center justify-between">
                <button
                  onClick={toggleSidebar}
                  className="flex items-center gap-2 p-1.5 -ml-1.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
                  aria-label="Toggle sidebar"
                >
                  <MenuIcon isOpen={sidebarCollapsed} />
                  <h1 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                    blossom
                  </h1>
                  <span className="text-xs self-end mb-[2px]" style={{ color: "var(--text-muted)" }}>
                    v{version}
                  </span>
                </button>

                <HeaderControls />
              </div>

              <div className="px-4 pb-3">
                <div className="flex gap-2 w-full">
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
                    placeholder={translations[language].placeholder}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{
                      backgroundColor: "var(--input-bg)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <button
                    onClick={handleLoadVideo}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "white",
                    }}
                  >
                    {translations[language].load}
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              <div className="px-4 py-6">
                <RecentVideosGrid
                  language={language}
                  onVideoSelect={(videoId, timestamp) => {
                    setVideo(
                      `https://www.youtube.com/watch?v=${videoId}`,
                      videoId,
                      null
                    );
                    setCurrentTimestamp(timestamp);
                    setLocation(`/youtube?v=${videoId}&t=${Math.floor(timestamp)}`);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
