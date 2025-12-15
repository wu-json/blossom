import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import { useQueryParams } from "../../hooks/use-query-params";
import { FlowerCard } from "./flower-card";
import { Search, X } from "lucide-react";
import type { Language } from "../../types/chat";

const translations: Record<Language, { searchPlaceholder: string; noResults: string }> = {
  ja: { searchPlaceholder: "花を検索...", noResults: "見つかりませんでした" },
  zh: { searchPlaceholder: "搜索花朵...", noResults: "没有找到结果" },
  ko: { searchPlaceholder: "꽃 검색...", noResults: "결과가 없습니다" },
};

export function FlowerList() {
  const { flowers, language } = useChatStore();
  const { navigateToGarden } = useNavigation();
  const { params, setQueryParams } = useQueryParams();
  const t = translations[language];

  // Get initial search query from URL
  const urlQuery = params.get("q") || "";

  // Local state for immediate input feedback
  const [inputValue, setInputValue] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync local state when URL changes (e.g., back/forward navigation)
  useEffect(() => {
    setInputValue(urlQuery);
  }, [urlQuery]);

  // Update URL when input changes (debounced)
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        setQueryParams({ q: value || undefined });
      }, 300);
    },
    [setQueryParams]
  );

  // Clear search
  const handleClear = useCallback(() => {
    setInputValue("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setQueryParams({ q: undefined });
  }, [setQueryParams]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Use URL query for filtering (not local state) to ensure consistency
  const filteredFlowers = useMemo(() => {
    if (!urlQuery.trim()) return flowers;
    const query = urlQuery.toLowerCase();
    return flowers.filter(
      (f) =>
        f.word.toLowerCase().includes(query) ||
        f.latestReading?.toLowerCase().includes(query)
    );
  }, [flowers, urlQuery]);

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
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full py-2 pl-10 pr-10 rounded-lg border text-sm outline-none transition-colors focus:border-[var(--primary)]"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
        {inputValue && (
          <button
            onClick={handleClear}
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
            onClick={() => navigateToGarden(flower.word)}
          />
        ))}
      </div>

      {/* Empty search state */}
      {filteredFlowers.length === 0 && urlQuery && (
        <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
          {t.noResults}
        </div>
      )}
    </div>
  );
}
