import { useEffect, useRef } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { useChatStore } from "../../store/chat-store";
import { SakuraIcon, MeiHuaIcon, MugunghwaIcon } from "../../components/icons/cultural-flowers";
import type { Language } from "../../types/chat";

const emptyStateContent: Record<Language, {
  icon: typeof SakuraIcon;
  title: string;
  subtitle: string;
}> = {
  ja: {
    icon: SakuraIcon,
    title: "桜のように、会話を咲かせよう",
    subtitle: "一言から始まる物語",
  },
  zh: {
    icon: MeiHuaIcon,
    title: "梅花香自苦寒来",
    subtitle: "让我们开始对话吧",
  },
  ko: {
    icon: MugunghwaIcon,
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const didTargetedScroll = useRef(false);

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
    // Skip auto-scroll if we just did a targeted scroll
    if (didTargetedScroll.current) {
      didTargetedScroll.current = false;
      return;
    }

    // During streaming, use instant scroll with shorter delay to keep up with content growth
    // After streaming, use smooth scroll for better UX
    const timeout = setTimeout(() => {
      bottomRef.current?.scrollIntoView({
        behavior: isTyping ? "instant" : "smooth",
      });
    }, isTyping ? 50 : 250);
    return () => clearTimeout(timeout);
  }, [messages, isTyping]);

  if (messages.length === 0) {
    const { icon: FlowerIcon, title, subtitle } = emptyStateContent[language];

    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-3"
        style={{ color: "var(--text-muted)" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <FlowerIcon className="w-8 h-8" style={{ color: "var(--primary)" }} />
        </div>
        <div className="text-center">
          <p className="text-base font-medium" style={{ color: "var(--text)" }}>
            {title}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
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
      if (messages[i].role === "user") {
        return {
          content: messages[i].content || "",
          images: messages[i].images,
        };
      }
    }
    return undefined;
  };

  return (
    <ScrollArea className="flex-1 p-4">
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
