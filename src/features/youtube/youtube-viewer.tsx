import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import {
  AlertCircle,
  Camera,
  CameraOff,
  Languages,
  Loader2,
  Play,
} from "lucide-react";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import {
  TranslationCard,
  TranslationSkeleton,
  StreamingTranslationCard,
} from "../../components/translation-card";
import { parseYouTubeUrl, formatTimestamp } from "./url-parser";
import { YouTubePlayer, type YouTubePlayerRef } from "./youtube-player";
import {
  CaptureSession,
  getPlayerBounds,
  isScreenCaptureSupported,
  blobToBase64,
} from "./frame-capture";
import {
  parseTranslationContent,
  hasTranslationMarkers,
  parseStreamingTranslation,
} from "../../lib/parse-translation";
import type {
  TranslationData,
  WordBreakdown,
  PartialTranslationData,
} from "../../types/translation";
import type { Language } from "../../types/chat";

interface YouTubeTranslation {
  id: string;
  videoId: string;
  videoTitle: string | null;
  timestampSeconds: number;
  frameImage: string | null;
  translationData: string;
}

type TranslationState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "streaming"; partial: PartialTranslationData | null }
  | { type: "complete"; data: TranslationData; translationId: string }
  | { type: "error"; message: string };

export function YouTubeViewer() {
  const language = useChatStore((state) => state.language);
  const { navigateToMeadow } = useNavigation();

  // URL handling
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const translationId = params.get("tid");

  // Video state
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Capture state
  const [isCaptureActive, setIsCaptureActive] = useState(false);
  const captureSessionRef = useRef(new CaptureSession());
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerRef>(null);

  // Translation state
  const [translationState, setTranslationState] = useState<TranslationState>({
    type: "idle",
  });
  const [savedTranslation, setSavedTranslation] =
    useState<YouTubeTranslation | null>(null);
  const [savedWords, setSavedWords] = useState<string[]>([]);

  // Check browser support
  const isSupported = isScreenCaptureSupported();

  // Load translation from URL parameter
  useEffect(() => {
    if (translationId) {
      fetch(`/api/youtube/translations/${translationId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Translation not found");
          return res.json();
        })
        .then((translation: YouTubeTranslation) => {
          setSavedTranslation(translation);
          setVideoId(translation.videoId);
          setVideoTitle(translation.videoTitle);
          try {
            const data = JSON.parse(translation.translationData);
            setTranslationState({
              type: "complete",
              data,
              translationId: translation.id,
            });
          } catch {
            // Invalid translation data
          }
        })
        .catch(() => {
          // Translation not found, continue with empty state
        });
    }
  }, [translationId]);

  // Seek to saved timestamp when player is ready
  const handlePlayerReady = useCallback(
    (videoData: { title: string; author: string }) => {
      setVideoTitle(videoData.title);
      setVideoUnavailable(false);

      // Seek to saved timestamp if we loaded from a translation
      if (savedTranslation && playerRef.current) {
        playerRef.current.seekTo(savedTranslation.timestampSeconds);
      }
    },
    [savedTranslation]
  );

  // Handle video errors
  const handlePlayerError = useCallback((errorCode: number) => {
    // Error codes: 100 = not found, 101/150 = embedding disabled
    if ([100, 101, 150].includes(errorCode)) {
      setVideoUnavailable(true);
    }
  }, []);

  // Setup capture session ended handler
  useEffect(() => {
    const session = captureSessionRef.current;
    session.onEnded(() => {
      setIsCaptureActive(false);
    });
    return () => session.stop();
  }, []);

  // Handle URL input
  const handleLoadVideo = () => {
    setUrlError(null);
    const id = parseYouTubeUrl(videoUrl);
    if (!id) {
      setUrlError("Invalid YouTube URL");
      return;
    }
    setVideoId(id);
    setVideoTitle(null);
    setVideoUnavailable(false);
    setSavedTranslation(null);
    setTranslationState({ type: "idle" });
    setSavedWords([]);
  };

  // Start screen capture session
  const handleStartCapture = async () => {
    try {
      await captureSessionRef.current.start();
      setIsCaptureActive(true);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "NotAllowedError"
      ) {
        // User cancelled, do nothing
        return;
      }
      console.error("Failed to start capture:", error);
    }
  };

  // Stop screen capture session
  const handleStopCapture = () => {
    captureSessionRef.current.stop();
    setIsCaptureActive(false);
  };

  // Capture frame and translate
  const handleTranslateClick = async () => {
    if (!captureSessionRef.current.isActive() || !playerContainerRef.current) {
      return;
    }

    try {
      setTranslationState({ type: "loading" });

      const playerBounds = getPlayerBounds(playerContainerRef.current);
      const currentTime = playerRef.current?.getCurrentTime() ?? 0;
      const { imageBlob, timestamp } =
        await captureSessionRef.current.grabFrame(currentTime, playerBounds);

      // Convert to base64
      const imageBase64 = await blobToBase64(imageBlob);

      // Call translation API
      const response = await fetch("/api/youtube/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          language,
          videoId,
          videoTitle,
          timestamp,
        }),
      });

      if (!response.ok) {
        throw new Error("Translation request failed");
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let newTranslationId = "";

      setTranslationState({ type: "streaming", partial: null });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            if (event.type === "translation_id") {
              newTranslationId = event.id;
            } else if (event.type === "content_block_delta") {
              if (event.delta?.type === "text_delta") {
                fullContent += event.delta.text;

                // Try to parse streaming translation
                const markers = hasTranslationMarkers(fullContent);
                if (markers.hasStart && !markers.hasEnd) {
                  const partial = parseStreamingTranslation(fullContent);
                  if (partial) {
                    setTranslationState({ type: "streaming", partial });
                  }
                }
              }
            } else if (event.type === "message_stop") {
              // Parse final translation
              const parsed = parseTranslationContent(fullContent);
              if (parsed.type === "translation") {
                setTranslationState({
                  type: "complete",
                  data: parsed.data,
                  translationId: newTranslationId,
                });
              } else {
                setTranslationState({
                  type: "error",
                  message: "Could not extract translation from response",
                });
              }
            }
          } catch {
            // Ignore parse errors for individual chunks
          }
        }
      }
    } catch (error) {
      console.error("Translation failed:", error);
      setTranslationState({
        type: "error",
        message:
          error instanceof Error ? error.message : "Translation failed",
      });
    }
  };

  // Handle saving a word as a petal
  const handleSaveWord = async (word: WordBreakdown): Promise<boolean> => {
    if (translationState.type !== "complete") return false;

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
          conversationId: null, // YouTube doesn't have conversations
          messageId: translationState.translationId,
          userInput: `YouTube: ${videoTitle || videoId}`,
          sourceType: "youtube",
          youtubeTranslationId: translationState.translationId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.duplicate) {
          return false;
        }
        throw new Error("Failed to save petal");
      }

      setSavedWords((prev) => [...prev, word.word]);
      return true;
    } catch (error) {
      console.error("Failed to save petal:", error);
      return false;
    }
  };

  // Handle removing a saved word
  const handleRemoveWord = async (word: string): Promise<boolean> => {
    if (translationState.type !== "complete") return false;

    try {
      const response = await fetch(
        `/api/petals/message/${translationState.translationId}/word/${encodeURIComponent(word)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to remove petal");
      }

      setSavedWords((prev) => prev.filter((w) => w !== word));
      return true;
    } catch (error) {
      console.error("Failed to remove petal:", error);
      return false;
    }
  };

  // Handle navigating to a flower
  const handleViewFlower = (word: string) => {
    navigateToMeadow(word);
  };

  // Render browser not supported message
  if (!isSupported) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div
          className="flex flex-col items-center gap-4 text-center max-w-md p-8 rounded-2xl"
          style={{ backgroundColor: "var(--surface)" }}
        >
          <AlertCircle size={48} style={{ color: "var(--text-muted)" }} />
          <h3 className="text-lg font-medium">Browser Not Supported</h3>
          <p style={{ color: "var(--text-muted)" }}>
            Your browser doesn't support screen capture. Please use a modern
            browser like Chrome, Firefox, Safari, or Edge.
          </p>
        </div>
      </div>
    );
  }

  // Render video unavailable fallback
  if (videoUnavailable && savedTranslation) {
    return (
      <div className="flex flex-1 flex-col p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          <div
            className="flex flex-col items-center gap-4 text-center p-8 rounded-2xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <AlertCircle size={48} style={{ color: "var(--text-muted)" }} />
            <h3 className="text-lg font-medium">Video Unavailable</h3>
            <p style={{ color: "var(--text-muted)" }}>
              This video is no longer available on YouTube.
            </p>
            {savedTranslation.videoTitle && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {savedTranslation.videoTitle}
              </p>
            )}
          </div>

          {savedTranslation.frameImage && (
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={`data:image/png;base64,${savedTranslation.frameImage}`}
                alt="Cached video frame"
                className="w-full"
              />
              <div
                className="absolute bottom-2 right-2 px-2 py-1 rounded text-sm font-mono"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                }}
              >
                {formatTimestamp(savedTranslation.timestampSeconds)}
              </div>
            </div>
          )}

          {translationState.type === "complete" && (
            <div
              className="p-6 rounded-2xl"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <TranslationCard
                data={translationState.data}
                onSaveWord={handleSaveWord}
                onRemoveWord={handleRemoveWord}
                onViewFlower={handleViewFlower}
                savedWords={savedWords}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* URL Input */}
        <div className="flex gap-3">
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setUrlError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
            placeholder="Paste YouTube URL..."
            className="flex-1 px-4 py-3 rounded-xl border outline-none transition-colors"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: urlError ? "#EF4444" : "var(--border)",
              color: "var(--text)",
            }}
          />
          <button
            onClick={handleLoadVideo}
            disabled={!videoUrl.trim()}
            className="px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: "var(--primary)",
              color: "white",
            }}
          >
            <Play size={20} />
          </button>
        </div>
        {urlError && (
          <p className="text-sm" style={{ color: "#EF4444" }}>
            {urlError}
          </p>
        )}

        {/* Video Player */}
        {videoId && (
          <div ref={playerContainerRef} className="rounded-xl overflow-hidden">
            <YouTubePlayer
              ref={playerRef}
              videoId={videoId}
              onReady={handlePlayerReady}
              onError={handlePlayerError}
            />
          </div>
        )}

        {/* Video Title */}
        {videoTitle && (
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {videoTitle}
          </p>
        )}

        {/* Capture Controls */}
        {videoId && (
          <div className="flex gap-3">
            {!isCaptureActive ? (
              <button
                onClick={handleStartCapture}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Camera size={18} />
                Start Capture
              </button>
            ) : (
              <>
                <button
                  onClick={handleStopCapture}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all"
                  style={{
                    backgroundColor: "var(--surface)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <CameraOff size={18} />
                  Stop Capture
                </button>
                <button
                  onClick={handleTranslateClick}
                  disabled={translationState.type === "loading" || translationState.type === "streaming"}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "white",
                  }}
                >
                  {translationState.type === "loading" || translationState.type === "streaming" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Languages size={18} />
                  )}
                  Translate Frame
                </button>
              </>
            )}
          </div>
        )}

        {/* First-time guidance */}
        {videoId && !isCaptureActive && translationState.type === "idle" && (
          <div
            className="p-4 rounded-xl text-sm"
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--text-muted)",
            }}
          >
            <p>
              <strong>How to use:</strong> Click "Start Capture" and select the
              browser window with the video. Then pause the video at any frame
              with text and click "Translate Frame" to get a word-by-word
              breakdown.
            </p>
          </div>
        )}

        {/* Translation Result */}
        {translationState.type === "loading" && (
          <div
            className="p-6 rounded-2xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <TranslationSkeleton />
          </div>
        )}

        {translationState.type === "streaming" && (
          <div
            className="p-6 rounded-2xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            {translationState.partial ? (
              <StreamingTranslationCard data={translationState.partial} />
            ) : (
              <TranslationSkeleton />
            )}
          </div>
        )}

        {translationState.type === "complete" && (
          <div
            className="p-6 rounded-2xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <TranslationCard
              data={translationState.data}
              onSaveWord={handleSaveWord}
              onRemoveWord={handleRemoveWord}
              onViewFlower={handleViewFlower}
              savedWords={savedWords}
            />
          </div>
        )}

        {translationState.type === "error" && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#EF4444",
            }}
          >
            <AlertCircle size={20} />
            <p>{translationState.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
