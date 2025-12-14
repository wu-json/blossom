import { Moon, Sun } from "lucide-react";
import { Toggle } from "../../components/ui/toggle";
import { MenuIcon } from "../../components/icons/menu-icon";
import { useChatStore } from "../../store/chat-store";
import { version } from "../../version";
import type { Language } from "../../types/chat";

const languageLabels: Record<Language, string> = {
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
};

export function ChatHeader() {
  const { theme, toggleTheme, language, setLanguage, toggleSidebar, sidebarCollapsed } = useChatStore();
  const isDark = theme === "dark";

  return (
    <header
      className="flex items-center justify-between px-4 py-3"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <button
        onClick={toggleSidebar}
        className="flex items-center gap-2 p-1.5 -ml-1.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
        aria-label="Toggle sidebar"
      >
        <MenuIcon isOpen={sidebarCollapsed} />
        <h1 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          blossom
        </h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          v{version}
        </span>
      </button>
      <div className="flex items-center gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="appearance-none bg-transparent px-3 py-1.5 pr-8 rounded-lg text-sm cursor-pointer focus:outline-none transition-colors"
          style={{
            color: "var(--text)",
            border: "1px solid var(--border)",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
          }}
        >
          {(Object.keys(languageLabels) as Language[]).map((lang) => (
            <option key={lang} value={lang}>
              {languageLabels[lang]}
            </option>
          ))}
        </select>
        <Toggle pressed={isDark} onClick={toggleTheme} aria-label="Toggle theme">
          {isDark ? (
            <Sun className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          ) : (
            <Moon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          )}
        </Toggle>
      </div>
    </header>
  );
}
