import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { useChatStore } from "../../store/chat-store";
import type { Language } from "../../types/chat";

const placeholders: Record<Language, string> = {
  ja: "何でも聞いてね...",
  zh: "想聊点什么？",
  ko: "무엇이든 물어보세요...",
};

export function ChatInput() {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const isTyping = useChatStore((state) => state.isTyping);
  const language = useChatStore((state) => state.language);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    sendMessage(trimmed);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const hasInput = input.trim().length > 0;
  const canSend = hasInput && !isTyping;

  return (
    <div className="p-4 pb-6">
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl mx-auto"
      >
        <div
          className="relative flex items-end rounded-2xl transition-shadow duration-200"
          style={{
            backgroundColor: "var(--input-bg)",
            boxShadow: isFocused
              ? "0 0 0 1px var(--border), 0 4px 16px rgba(0, 0, 0, 0.12)"
              : "0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--border)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholders[language]}
            rows={1}
            className="flex-1 resize-none bg-transparent pl-4 pr-14 py-3.5 text-[14px] focus-visible:outline-none min-h-[52px] max-h-[160px] placeholder:text-[var(--text-muted)]"
            style={{
              color: "var(--text)",
              height: "auto",
              overflow: "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="absolute right-2 bottom-2 h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            style={{
              backgroundColor: canSend ? "var(--primary)" : "var(--border)",
              color: canSend ? "white" : "var(--text-muted)",
              opacity: canSend ? 1 : 0.6,
            }}
          >
            <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </div>
  );
}
