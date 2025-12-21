import { useEffect, useRef, useState, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { Loader2, Languages, AlertCircle, ExternalLink, X, Share2, Check } from "lucide-react";
import { useYouTubeStore } from "../../store/youtube-store";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import { TranslationCard, TranslationSkeleton, StreamingTranslationCard } from "../../components/translation-card";
import { parseTranslationContent, hasTranslationMarkers, parseStreamingTranslation } from "../../lib/parse-translation";
import { TranslationTimeline } from "./translation-timeline";
import { useVideoTranslations, type YouTubeTranslation } from "./hooks/use-video-translations";
import { useActiveTranslation } from "./hooks/use-active-translation";
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

// YouTube URL parsing
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

// Format timestamp for display
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
  } = useYouTubeStore();

  const language = useChatStore((state) => state.language);
  const { navigateToMeadow } = useNavigation();

  const [inputUrl, setInputUrl] = useState(videoUrl);
  const [playerReady, setPlayerReady] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [savedWords, setSavedWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [timelineSavedWords, setTimelineSavedWords] = useState<Record<string, string[]>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const apiLoadedRef = useRef(false);

  // Timeline hooks
  const { translations: videoTranslations, addTranslation, updateDuration, refetch: refetchTranslations } = useVideoTranslations(videoId);
  const timelineActiveTranslation = useActiveTranslation(videoTranslations, currentPlaybackTime);

  // Load YouTube IFrame API
  useEffect(() => {
    if (apiLoadedRef.current) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    apiLoadedRef.current = true;
  }, []);

  // Handle URL parameter navigation (from petal)
  useEffect(() => {
    if (translationId) {
      fetchTranslationRecord(translationId);
    }
  }, [translationId]);

  // Handle URL params for shareable links (?v=VIDEO_ID&t=TIMESTAMP)
  useEffect(() => {
    if (urlVideoId && !translationId && urlVideoId !== videoId) {
      const url = `https://www.youtube.com/watch?v=${urlVideoId}`;
      setVideo(url, urlVideoId, null);
      setInputUrl(url);
      setCurrentTranslation(null);
      setCurrentFrameImage(null);
      setError(null);
      setSavedWords([]);
      // Set timestamp if provided (will be used in onReady)
      if (urlTimestamp) {
        setCurrentTimestamp(parseFloat(urlTimestamp));
      } else {
        setCurrentTimestamp(0);
      }
    }
  }, [urlVideoId, urlTimestamp, translationId]);

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

    // Clean up existing player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
      setPlayerReady(false);
    }

    // Wait for API to be ready
    const initPlayer = () => {
      if (!window.YT || !containerRef.current) return;

      // Clear container
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
        },
        events: {
          onReady: (event) => {
            setPlayerReady(true);
            const data = event.target.getVideoData();
            if (data.title && !videoTitle) {
              setVideo(videoUrl, videoId, data.title);
            }

            // Get video duration for timeline
            const duration = event.target.getDuration();
            setVideoDuration(duration);

            // Seek to timestamp if we have one from URL params
            if (currentTimestamp > 0) {
              event.target.seekTo(currentTimestamp, true);
            }

            // Pre-cache the stream URL in the background
            fetch("/api/youtube/precache-stream", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ videoId }),
            }).catch(() => {});
          },
          onError: (event) => {
            // Error codes: 100 = not found, 101/150 = embedding disabled
            if ([100, 101, 150].includes(event.data)) {
              setVideoUnavailable(true);
            }
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

  // Poll current time from player for timeline
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    const interval = setInterval(() => {
      const time = playerRef.current?.getCurrentTime() ?? 0;
      setCurrentPlaybackTime(time);
    }, 250); // Update 4x per second

    return () => clearInterval(interval);
  }, [playerReady]);

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
      // Extract high-quality frame and save to disk
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

      // Translate frame (API compresses internally)
      const translateResponse = await fetch("/api/youtube/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: frameFilename, language }),
      });

      if (!translateResponse.ok) {
        const data = await translateResponse.json();
        throw new Error(data.error || "Failed to translate");
      }

      // Handle streaming response
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

      // Parse final translation
      const parsedContent = parseTranslationContent(fullContent);
      if (parsedContent.type === "translation") {
        // Save translation to database with frame filename
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

        // Set translation only once, with ID if save succeeded
        if (saveResponse.ok) {
          const savedTranslation = await saveResponse.json();
          setCurrentTranslation(parsedContent.data, savedTranslation.id);

          // Add to timeline
          addTranslation({
            id: savedTranslation.id,
            videoId: videoId!,
            videoTitle: videoTitle,
            timestampSeconds: timestamp,
            durationSeconds: 5.0,
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
      // Don't clear streamingContent here - it causes a flash
      // It's cleared at the start of each new translation anyway
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

  // Timeline handlers
  const handleTimelineMarkerClick = useCallback((translation: YouTubeTranslation) => {
    playerRef.current?.seekTo(translation.timestampSeconds, true);
  }, []);

  const handleTimelineSeek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const handleTimelineDurationChange = useCallback((translationId: string, durationSeconds: number) => {
    updateDuration(translationId, durationSeconds);
  }, [updateDuration]);

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

  // Render translation content based on streaming state
  const renderTranslationContent = () => {
    // If we have final translation data, show the final card
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

    // Otherwise, parse streaming content to determine what to show
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
      // Still streaming
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
        {/* Error Display */}
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

        {/* Video Player or Unavailable State */}
        {videoId && (
          <div className="flex flex-col h-full">
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
                {/* Show cached frame */}
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
              <>
                {/* Video Title Bar */}
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
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Full-width Video */}
                <div
                  ref={containerRef}
                  className="w-full aspect-video flex-shrink-0"
                  style={{ backgroundColor: "var(--surface)" }}
                />

                {/* Timeline below video */}
                {playerReady && videoDuration > 0 && videoTranslations.length > 0 && (
                  <TranslationTimeline
                    videoId={videoId!}
                    videoDuration={videoDuration}
                    currentTime={currentPlaybackTime}
                    translations={videoTranslations}
                    activeTranslationId={timelineActiveTranslation?.id ?? null}
                    onMarkerClick={handleTimelineMarkerClick}
                    onDurationChange={handleTimelineDurationChange}
                    onSeek={handleTimelineSeek}
                  />
                )}
              </>
            )}

            {/* Translation Result - show streaming OR timeline active translation */}
            {(isTranslating || timelineActiveTranslation?.translationData) && (
              <div className="flex-1 overflow-auto px-4 pt-4 pb-16">
                <div
                  className="max-w-3xl mx-auto rounded-xl px-4 py-4"
                  style={{
                    backgroundColor: "var(--assistant-bubble)",
                    color: "var(--assistant-bubble-text)",
                  }}
                >
                  {/* Priority: streaming > timeline active */}
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

        {/* Empty State with URL Input */}
        {!videoId && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pb-10"
            style={{ color: "var(--text-muted)" }}
          >
            <h3 className="font-medium mb-1" style={{ color: "var(--text)" }}>
              {translations[language].title}
            </h3>
            <p className="text-sm mb-6 max-w-sm">
              {translations[language].description}
            </p>
            <div className="flex gap-2 w-full max-w-md">
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
        )}
      </div>
    </div>
  );
}
