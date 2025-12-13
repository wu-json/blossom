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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
