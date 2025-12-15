import { useState, useMemo } from "react";
import { useChatStore } from "../../store/chat-store";
import { FlowerCard } from "./flower-card";
import { Search, X } from "lucide-react";
import type { Language } from "../../types/chat";

const translations: Record<Language, { searchPlaceholder: string; noResults: string }> = {
  ja: { searchPlaceholder: "花を検索...", noResults: "見つかりませんでした" },
  zh: { searchPlaceholder: "搜索花朵...", noResults: "没有找到结果" },
  ko: { searchPlaceholder: "꽃 검색...", noResults: "결과가 없습니다" },
};

export function FlowerList() {
  const { flowers, selectFlower, language } = useChatStore();
  const t = translations[language];
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFlowers = useMemo(() => {
    if (!searchQuery.trim()) return flowers;
    const query = searchQuery.toLowerCase();
    return flowers.filter(
      (f) =>
        f.word.toLowerCase().includes(query) ||
        f.latestReading?.toLowerCase().includes(query)
    );
  }, [flowers, searchQuery]);

  return (
    <div className="w-full">
      {/* Search input */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full py-2 pl-10 pr-10 rounded-lg border text-sm outline-none transition-colors focus:border-[var(--primary)]"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Flower list */}
      <div className="grid gap-3">
        {filteredFlowers.map((flower) => (
          <FlowerCard
            key={flower.word}
            flower={flower}
            onClick={() => selectFlower(flower.word)}
          />
        ))}
      </div>

      {/* Empty search state */}
      {filteredFlowers.length === 0 && searchQuery && (
        <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
          {t.noResults}
        </div>
      )}
    </div>
  );
}
