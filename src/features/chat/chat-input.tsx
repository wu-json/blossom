import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useChatStore } from "../../store/chat-store";

export function ChatInput() {
  const [input, setInput] = useState("");
  const addMessage = useChatStore((state) => state.addMessage);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    addMessage(trimmed, "user");
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      className="p-4"
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex gap-3 max-w-3xl mx-auto items-end"
      >
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full resize-none rounded-xl px-4 py-3 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-h-[48px] max-h-[200px]"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--input-bg)",
              color: "var(--text)",
              height: "auto",
              overflow: "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim()}
          className="h-12 w-12 shrink-0"
        >
          <Send className="w-5 h-5" />
        </Button>
      </form>
      <p
        className="text-xs text-center mt-2 max-w-3xl mx-auto"
        style={{ color: "var(--text-muted)" }}
      >
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
