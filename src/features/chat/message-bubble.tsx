import { cn } from "../../lib/utils";
import type { Message } from "../../types/chat";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("group flex w-full", isUser ? "justify-end" : "justify-start")}>
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
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
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
