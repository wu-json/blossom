import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../store/chat-store";
import { useSmoothText } from "../../hooks/use-smooth-text";
import { Markdown } from "../../components/markdown";
import {
  TranslationCard,
  TranslationSkeleton,
} from "../../components/translation-card";
import {
  parseTranslationContent,
  hasTranslationMarkers,
} from "../../lib/parse-translation";
import type { Message } from "../../types/chat";
import type { ParsedContent } from "../../types/translation";

interface MessageBubbleProps {
  message: Message;
  isLastAssistant?: boolean;
}

export function MessageBubble({ message, isLastAssistant }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isTyping = useChatStore((state) => state.isTyping);
  const teacherSettings = useChatStore((state) => state.teacherSettings);
  const isStreaming = !isUser && isLastAssistant && isTyping;
  const displayedContent = useSmoothText(message.content, isStreaming);

  const parsed: ParsedContent = useMemo(() => {
    if (isUser) return { type: "text", data: displayedContent };

    if (isStreaming) {
      const markers = hasTranslationMarkers(displayedContent);
      if (markers.hasStart && !markers.hasEnd) {
        return { type: "streaming-translation", data: null };
      }
    }
    return parseTranslationContent(displayedContent);
  }, [displayedContent, isStreaming, isUser]);

  const showAvatar = !isUser && teacherSettings?.profileImagePath;

  return (
    <div className={cn("group flex w-full", isUser ? "justify-end" : "justify-start")}>
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
              ) : parsed.type === "translation" ? (
                <TranslationCard data={parsed.data} />
              ) : (
                <Markdown content={displayedContent} />
              )}
              {isStreaming && parsed.type !== "streaming-translation" && (
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
