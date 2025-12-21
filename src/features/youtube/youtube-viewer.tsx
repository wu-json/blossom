import { useEffect, useRef, useState, useCallback } from "react";
import { useSearch } from "wouter";
import { Loader2, Camera, AlertCircle, ExternalLink } from "lucide-react";
import { useYouTubeStore } from "../../store/youtube-store";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import { TranslationCard, TranslationSkeleton, StreamingTranslationCard } from "../../components/translation-card";
import { parseTranslationContent, hasTranslationMarkers, parseStreamingTranslation } from "../../lib/parse-translation";
import type { TranslationData, WordBreakdown, PartialTranslationData } from "../../types/translation";
import type { Language } from "../../types/chat";

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
  const params = new URLSearchParams(searchString);
  const translationId = params.get("tid");

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

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const apiLoadedRef = useRef(false);

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

            // Seek to timestamp if we have one from URL params
            if (currentTimestamp > 0) {
              event.target.seekTo(currentTimestamp, true);
            }
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

  const handleLoadVideo = () => {
    const id = parseYouTubeUrl(inputUrl);
    if (id) {
      setVideo(inputUrl, id, null);
      setCurrentTranslation(null);
      setCurrentFrameImage(null);
      setCurrentTimestamp(0);
      setError(null);
      setSavedWords([]);
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

    try {
      // Extract frame
      const extractResponse = await fetch("/api/youtube/extract-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, timestamp }),
      });

      if (!extractResponse.ok) {
        const data = await extractResponse.json();
        throw new Error(data.error || "Failed to extract frame");
      }

      const { imageBase64 } = await extractResponse.json();
      setCurrentFrameImage(`data:image/png;base64,${imageBase64}`);
      setExtracting(false);
      setTranslating(true);

      // Translate frame
      const translateResponse = await fetch("/api/youtube/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, language }),
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
        setCurrentTranslation(parsedContent.data);

        // Save translation to database
        const saveResponse = await fetch("/api/youtube/translations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            videoTitle,
            timestampSeconds: timestamp,
            frameImage: `data:image/png;base64,${imageBase64}`,
            translationData: parsedContent.data,
          }),
        });

        if (saveResponse.ok) {
          const saved = await saveResponse.json();
          setCurrentTranslation(parsedContent.data, saved.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setExtracting(false);
      setTranslating(false);
      setStreamingContent("");
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

  // Render streaming content
  const renderStreamingContent = () => {
    if (!streamingContent) return <TranslationSkeleton />;

    const markers = hasTranslationMarkers(streamingContent);

    if (markers.isStarting) {
      return <TranslationSkeleton />;
    }

    if (markers.hasStart && !markers.hasEnd) {
      const partialData = parseStreamingTranslation(streamingContent);
      if (partialData && hasAnyContent(partialData)) {
        return <StreamingTranslationCard data={partialData} />;
      }
      return <TranslationSkeleton />;
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* URL Input */}
      <div
        className="flex-shrink-0 px-6 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
            placeholder="Paste YouTube URL..."
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
            Load
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {/* Error Display */}
          {error && (
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
          )}

          {/* Video Player or Unavailable State */}
          {videoId && (
            <>
              {videoUnavailable && currentFrameImage ? (
                <div className="space-y-4">
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
                <div
                  ref={containerRef}
                  className="w-full aspect-video rounded-xl overflow-hidden"
                  style={{ backgroundColor: "var(--surface)" }}
                />
              )}

              {/* Video Title */}
              {videoTitle && !videoUnavailable && (
                <h2
                  className="text-lg font-medium"
                  style={{ color: "var(--text)" }}
                >
                  {videoTitle}
                </h2>
              )}

              {/* Translate Button */}
              {playerReady && !videoUnavailable && (
                <button
                  onClick={handleTranslateFrame}
                  disabled={isExtracting || isTranslating}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "white",
                  }}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Extracting frame...
                    </>
                  ) : isTranslating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      Translate Frame
                    </>
                  )}
                </button>
              )}

              {/* Frame Preview (during processing) */}
              {currentFrameImage && (isExtracting || isTranslating) && (
                <div className="relative">
                  <img
                    src={currentFrameImage}
                    alt="Captured frame"
                    className="w-full rounded-xl opacity-75"
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
              )}

              {/* Translation Result */}
              {(isTranslating || currentTranslation) && (
                <div
                  className="rounded-xl px-4 py-4"
                  style={{
                    backgroundColor: "var(--assistant-bubble)",
                    color: "var(--assistant-bubble-text)",
                  }}
                >
                  {isTranslating ? (
                    renderStreamingContent()
                  ) : currentTranslation ? (
                    <TranslationCard
                      data={currentTranslation}
                      onSaveWord={currentTranslationId ? handleSaveWord : undefined}
                      onRemoveWord={currentTranslationId ? handleRemoveWord : undefined}
                      onViewFlower={currentTranslationId ? handleViewFlower : undefined}
                      savedWords={savedWords}
                    />
                  ) : null}
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!videoId && (
            <div
              className="flex flex-col items-center justify-center py-16 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: "var(--surface)" }}
              >
                <Camera size={32} />
              </div>
              <h3 className="font-medium mb-2" style={{ color: "var(--text)" }}>
                YouTube Frame Translator
              </h3>
              <p className="text-sm max-w-sm">
                Paste a YouTube URL above, play the video, and click "Translate
                Frame" to get word-by-word translations of any text in the video.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
