import { useEffect } from "react";
import { Moon, Sun, AlertTriangle } from "lucide-react";
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

export function Header() {
  const { theme, toggleTheme, language, setLanguage, toggleSidebar, sidebarCollapsed, apiKeyConfigured, checkApiKeyStatus } = useChatStore();
  const isDark = theme === "dark";

  useEffect(() => {
    checkApiKeyStatus();
  }, [checkApiKeyStatus]);

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
        <span className="text-sm self-end mb-[2px]" style={{ color: "var(--text-muted)" }}>
          v{version}
        </span>
        {apiKeyConfigured === false && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:scale-105"
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)"
                : "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%)",
              color: isDark ? "#FCD34D" : "#B45309",
              border: isDark ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
              boxShadow: isDark
                ? "0 2px 8px rgba(251, 191, 36, 0.1)"
                : "0 2px 8px rgba(245, 158, 11, 0.1)",
            }}
            title="Set ANTHROPIC_API_KEY environment variable to enable AI responses"
          >
            <AlertTriangle className="w-3 h-3" />
            ANTHROPIC_API_KEY not set
          </span>
        )}
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
