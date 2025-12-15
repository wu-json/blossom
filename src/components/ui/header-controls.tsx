import { Moon, Sun } from "lucide-react";
import { Toggle } from "./toggle";
import { useChatStore } from "../../store/chat-store";
import type { Language } from "../../types/chat";

const languageLabels: Record<Language, string> = {
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
};

export function HeaderControls() {
  const { theme, toggleTheme, language, setLanguage } = useChatStore();
  const isDark = theme === "dark";

  return (
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
  );
}
