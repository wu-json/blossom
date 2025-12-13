import { Moon, Sun, Flower2 } from "lucide-react";
import { Toggle } from "../../components/ui/toggle";
import { useChatStore } from "../../store/chat-store";

export function ChatHeader() {
  const { theme, toggleTheme } = useChatStore();
  const isDark = theme === "dark";

  return (
    <header
      className="flex items-center justify-between px-6 py-4"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="flex items-center gap-2">
        <Flower2 className="w-6 h-6" style={{ color: "var(--primary)" }} />
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
          Blossom
        </h1>
      </div>
      <Toggle pressed={isDark} onClick={toggleTheme} aria-label="Toggle theme">
        {isDark ? (
          <Sun className="w-5 h-5" style={{ color: "var(--primary)" }} />
        ) : (
          <Moon className="w-5 h-5" style={{ color: "var(--text)" }} />
        )}
      </Toggle>
    </header>
  );
}
