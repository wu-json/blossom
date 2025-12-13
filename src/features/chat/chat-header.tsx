import { Moon, Sun, Sparkles } from "lucide-react";
import { Toggle } from "../../components/ui/toggle";
import { useChatStore } from "../../store/chat-store";

export function ChatHeader() {
  const { theme, toggleTheme } = useChatStore();
  const isDark = theme === "dark";

  return (
    <header
      className="flex items-center justify-between px-5 py-3"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5" style={{ color: "var(--primary)" }} />
        <h1 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          Blossom
        </h1>
      </div>
      <Toggle pressed={isDark} onClick={toggleTheme} aria-label="Toggle theme">
        {isDark ? (
          <Sun className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        ) : (
          <Moon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        )}
      </Toggle>
    </header>
  );
}
