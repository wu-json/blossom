import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import { useSmoothText } from "../../hooks/use-smooth-text";
import { Markdown } from "../../components/markdown";
import {
  TranslationCard,
  TranslationSkeleton,
  StreamingTranslationCard,
} from "../../components/translation-card";
import {
  parseTranslationContent,
  hasTranslationMarkers,
  parseStreamingTranslation,
} from "../../lib/parse-translation";
import type { PartialTranslationData } from "../../types/translation";
import type { Message } from "../../types/chat";
import type { ParsedContent, WordBreakdown } from "../../types/translation";

interface MessageBubbleProps {
  message: Message;
  isLastAssistant?: boolean;
  userInput?: string;
  userImages?: string[];
}

export function MessageBubble({ message, isLastAssistant, userInput, userImages }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isTyping = useChatStore((state) => state.isTyping);
  const teacherSettings = useChatStore((state) => state.teacherSettings);
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const savePetal = useChatStore((state) => state.savePetal);
  const removePetalFromMessage = useChatStore((state) => state.removePetalFromMessage);
  const savedPetalWords = useChatStore((state) => state.savedPetalWords);
  const savedWordsForMessage = savedPetalWords[message.id] || [];
  const { navigateToGarden } = useNavigation();

  const handleSaveWord = (word: WordBreakdown) => {
    if (currentConversationId && (userInput || userImages?.length)) {
      savePetal(word, currentConversationId, message.id, userInput || "", userImages);
    }
  };

  const handleRemoveWord = async (word: string) => {
    return removePetalFromMessage(message.id, word);
  };

  const handleViewFlower = (word: string) => {
    navigateToGarden(word);
  };

  const canSaveWords = !isUser && currentConversationId && (userInput || userImages?.length);
  const isStreaming = !isUser && !!isLastAssistant && isTyping;
  const displayedContent = useSmoothText(message.content, isStreaming);

  const parsed: ParsedContent = useMemo(() => {
    if (isUser) return { type: "text", data: displayedContent };

    if (isStreaming) {
      const markers = hasTranslationMarkers(displayedContent);

      // Show skeleton if we're starting to type the marker
      if (markers.isStarting) {
        return { type: "streaming-translation", data: null };
      }

      // If we have the start marker, try to parse partial content
      if (markers.hasStart && !markers.hasEnd) {
        const partialData = parseStreamingTranslation(displayedContent);
        if (partialData && hasAnyContent(partialData)) {
          return { type: "streaming-partial", data: partialData };
        }
        // Fall back to skeleton if no parseable content yet
        return { type: "streaming-translation", data: null };
      }
    }
    return parseTranslationContent(displayedContent);
  }, [displayedContent, isStreaming, isUser]);

  function hasAnyContent(data: PartialTranslationData): boolean {
    return !!(
      data.originalText ||
      data.subtext ||
      data.translation ||
      (data.breakdown && data.breakdown.length > 0) ||
      data.grammarNotes
    );
  }

  const showAvatar = !isUser && teacherSettings?.profileImagePath;

  return (
    <div
      className={cn("group flex w-full", isUser ? "justify-end" : "justify-start")}
      data-message-id={message.id}
    >
      {/* Teacher Avatar */}
      {showAvatar && (
        <div className="flex-shrink-0 mr-2.5 self-end mb-1">
          <img
            src={teacherSettings.profileImagePath!}
            alt=""
            className="w-7 h-7 rounded-full object-cover ring-2 ring-white/10"
            style={{
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            }}
          />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 transition-colors duration-150",
          isUser ? "rounded-br-sm" : "rounded-bl-sm"
        )}
        style={
          isUser
            ? {
                backgroundColor: "var(--user-bubble)",
                color: "var(--user-bubble-text)",
              }
            : {
                backgroundColor: "var(--assistant-bubble)",
                color: "var(--assistant-bubble-text)",
              }
        }
      >
        {/* Render attached images */}
        {message.images && message.images.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-1.5 mb-2",
              message.images.length === 1 ? "max-w-[280px]" : ""
            )}
          >
            {message.images.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Attachment ${index + 1}`}
                className={cn(
                  "rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity",
                  message.images!.length === 1
                    ? "max-w-full max-h-[200px] w-auto"
                    : "w-[100px] h-[100px]"
                )}
                onClick={() => window.open(url, "_blank")}
              />
            ))}
          </div>
        )}
        <div className="text-[14px] leading-relaxed">
          {isStreaming && !displayedContent ? (
            <span className="inline-flex gap-1 items-center h-[1em]">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: "var(--assistant-bubble-text)",
                    opacity: 0.6,
                    animation: "loading-dot 1.4s ease-in-out infinite",
                    animationDelay: `${i * 0.16}s`,
                  }}
                />
              ))}
              <style>{`
                @keyframes loading-dot {
                  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                  40% { transform: scale(1); opacity: 0.8; }
                }
              `}</style>
            </span>
          ) : (
            <>
              {isUser ? (
                <p className="whitespace-pre-wrap break-words">{displayedContent}</p>
              ) : parsed.type === "streaming-translation" ? (
                <TranslationSkeleton />
              ) : parsed.type === "streaming-partial" ? (
                <StreamingTranslationCard data={parsed.data} />
              ) : parsed.type === "translation" ? (
                <TranslationCard
                  data={parsed.data}
                  onSaveWord={canSaveWords ? handleSaveWord : undefined}
                  onRemoveWord={canSaveWords ? handleRemoveWord : undefined}
                  onViewFlower={canSaveWords ? handleViewFlower : undefined}
                  savedWords={savedWordsForMessage}
                />
              ) : (
                <Markdown content={displayedContent} />
              )}
              {isStreaming && parsed.type !== "streaming-translation" && parsed.type !== "streaming-partial" && (
                <span
                  className="inline-block w-[2px] h-[1em] ml-0.5 align-middle animate-pulse"
                  style={{ backgroundColor: "var(--assistant-bubble-text)", opacity: 0.7 }}
                />
              )}
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "self-end text-[11px] px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          isUser ? "order-first" : "order-last"
        )}
        style={{ color: "var(--text-subtle)" }}
      >
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
