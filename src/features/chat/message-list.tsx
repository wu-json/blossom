import { useEffect, useRef } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { useChatStore } from "../../store/chat-store";
import { MessageCircle } from "lucide-react";

export function MessageList() {
  const messages = useChatStore((state) => state.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-4"
        style={{ color: "var(--text-muted)" }}
      >
        <MessageCircle className="w-16 h-16 opacity-30" />
        <p className="text-lg">Start a conversation</p>
        <p className="text-sm">Type a message below to begin</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
