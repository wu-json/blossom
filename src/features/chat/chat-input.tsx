import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
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

  const hasInput = input.trim().length > 0;

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: "var(--surface)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 max-w-2xl mx-auto items-end"
      >
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="w-full resize-none rounded-xl px-4 py-3 text-[14px] transition-all duration-150 focus-visible:outline-none min-h-[48px] max-h-[160px]"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--input-bg)",
              color: "var(--text)",
              height: "auto",
              overflow: "hidden",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!hasInput}
          className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors duration-150 disabled:opacity-30"
          style={{
            backgroundColor: hasInput ? "var(--primary)" : "var(--border)",
            color: hasInput ? "white" : "var(--text-muted)",
          }}
        >
          <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
