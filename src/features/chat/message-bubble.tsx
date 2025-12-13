import { cn } from "../../lib/utils";
import type { Message } from "../../types/chat";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-200",
          isUser ? "rounded-br-md" : "rounded-bl-md"
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
                border: "1px solid var(--border)",
              }
        }
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <span
          className={cn(
            "text-xs mt-1 block opacity-70",
            isUser ? "text-right" : "text-left"
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
