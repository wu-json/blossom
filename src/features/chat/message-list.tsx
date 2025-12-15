import { useEffect, useRef } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { useChatStore } from "../../store/chat-store";
import type { Language } from "../../types/chat";

const emptyStateContent: Record<Language, {
  title: string;
  subtitle: string;
}> = {
  ja: {
    title: "桜のように、会話を咲かせよう",
    subtitle: "一言から始まる物語",
  },
  zh: {
    title: "梅花香自苦寒来",
    subtitle: "让我们开始对话吧",
  },
  ko: {
    title: "무궁화처럼 피어나는 대화",
    subtitle: "첫 마디를 건네보세요",
  },
};

export function MessageList() {
  const messages = useChatStore((state) => state.messages);
  const language = useChatStore((state) => state.language);
  const isTyping = useChatStore((state) => state.isTyping);
  const scrollToMessageId = useChatStore((state) => state.scrollToMessageId);
  const setScrollToMessage = useChatStore((state) => state.setScrollToMessage);
  const setStreamingTransition = useChatStore((state) => state.setStreamingTransition);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didTargetedScroll = useRef(false);
  const lastScrollTime = useRef(0);
  const prevIsTyping = useRef(isTyping);

  // Scroll to specific message (from garden petal card)
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0) {
      didTargetedScroll.current = true;
      const timeout = setTimeout(() => {
        const element = document.querySelector(`[data-message-id="${scrollToMessageId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setScrollToMessage(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [scrollToMessageId, messages, setScrollToMessage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const wasTyping = prevIsTyping.current;
    prevIsTyping.current = isTyping;

    // When streaming ends, coordinate scroll and component transition
    if (wasTyping && !isTyping) {
      // Keep streaming UI visible during scroll
      setStreamingTransition(true);

      const scrollContainer = document.querySelector("[data-message-list]");
      let scrollEndTimeout: ReturnType<typeof setTimeout>;
      let cleanupCalled = false;

      const detectScrollEnd = () => {
        // Reset the timeout on each scroll event
        clearTimeout(scrollEndTimeout);
        scrollEndTimeout = setTimeout(() => {
          // Scrolling has stopped - allow component transition
          if (!cleanupCalled) {
            setStreamingTransition(false);
            scrollContainer?.removeEventListener("scroll", detectScrollEnd);
          }
        }, 100);
      };

      // Start listening for scroll end
      scrollContainer?.addEventListener("scroll", detectScrollEnd);

      // Trigger the scroll after a short delay
      const scrollTimeout = setTimeout(() => {
        lastScrollTime.current = Date.now();
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });

        // Start the scroll end detection
        detectScrollEnd();
      }, 100);

      return () => {
        cleanupCalled = true;
        clearTimeout(scrollTimeout);
        clearTimeout(scrollEndTimeout);
        scrollContainer?.removeEventListener("scroll", detectScrollEnd);
      };
    }

    if (didTargetedScroll.current) {
      didTargetedScroll.current = false;
      return;
    }

    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime.current;

    // During streaming: throttle to 150ms
    const delay = isTyping
      ? Math.max(0, 150 - timeSinceLastScroll)
      : 100;

    const timeout = setTimeout(() => {
      lastScrollTime.current = Date.now();
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, delay);

    return () => clearTimeout(timeout);
  }, [messages, isTyping, setStreamingTransition]);

  if (messages.length === 0) {
    const { title, subtitle } = emptyStateContent[language];

    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
        style={{ animation: "fadeIn 0.5s ease-out" }}
      >
        {/* Animated flower illustration */}
        <div
          className="relative"
          style={{ animation: "float 4s ease-in-out infinite" }}
        >
          {/* Soft glow background */}
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{
              background: "var(--primary)",
              animation: "breathe 4s ease-in-out infinite",
              transform: "scale(1.5)",
            }}
          />
          {/* Flower SVG */}
          <svg
            width="64"
            height="64"
            viewBox="0 0 80 80"
            fill="none"
            className="relative"
          >
            {/* Petals */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <ellipse
                key={i}
                cx="40"
                cy="40"
                rx="12"
                ry="20"
                fill="var(--primary)"
                opacity={0.7 + (i % 2) * 0.15}
                transform={`rotate(${angle} 40 40) translate(0 -16)`}
              />
            ))}
            {/* Center */}
            <circle cx="40" cy="40" r="10" fill="var(--primary-hover)" />
          </svg>
        </div>

        {/* Text content */}
        <div className="text-center">
          <h2
            className="text-lg font-semibold mb-1"
            style={{ color: "var(--text)" }}
          >
            {title}
          </h2>
          <p
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    );
  }

  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant");

  // Find the user input that prompted each assistant message
  const getUserContextForAssistant = (index: number): { content: string; images?: string[] } | undefined => {
    // Look backwards for the most recent user message before this assistant message
    for (let i = index - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "user") {
        return {
          content: msg.content || "",
          images: msg.images,
        };
      }
    }
    return undefined;
  };

  return (
    <ScrollArea className="flex-1 p-4" data-message-list>
      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {messages.map((message, index) => {
          const userContext = message.role === "assistant" ? getUserContextForAssistant(index) : undefined;
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isLastAssistant={index === lastAssistantIndex}
              userInput={userContext?.content}
              userImages={userContext?.images}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
