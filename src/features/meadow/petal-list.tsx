import { useEffect } from "react";
import { useChatStore } from "../../store/chat-store";
import { useQueryParams } from "../../hooks/use-query-params";
import { PetalCard } from "./petal-card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Language } from "../../types/chat";

const PETALS_PER_PAGE = 20;

const translations: Record<Language, { contexts: string }> = {
  ja: { contexts: "コンテキスト" },
  zh: { contexts: "上下文" },
  ko: { contexts: "문맥" },
};

export function PetalList() {
  const { selectedFlower, flowerPetals, language } = useChatStore();
  const { params, setQueryParams } = useQueryParams();
  const t = translations[language];

  // Get current page from URL (default to 1)
  const urlPage = parseInt(params.get("page") || "1", 10);
  const currentPage = isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;

  // Calculate pagination
  const totalPages = Math.ceil(flowerPetals.length / PETALS_PER_PAGE);
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  const startIndex = (validPage - 1) * PETALS_PER_PAGE;
  const paginatedPetals = flowerPetals.slice(startIndex, startIndex + PETALS_PER_PAGE);

  // Reset to page 1 when flower changes
  useEffect(() => {
    if (currentPage !== 1) {
      setQueryParams({ page: undefined });
    }
  }, [selectedFlower]);

  // Update URL when page changes
  const goToPage = (page: number) => {
    if (page === 1) {
      setQueryParams({ page: undefined });
    } else {
      setQueryParams({ page });
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-4" style={{ color: "var(--text)" }}>
        <span className="text-3xl font-bold">{selectedFlower}</span>
        <span className="text-sm font-normal ml-3" style={{ color: "var(--text-muted)" }}>
          {flowerPetals.length} {t.contexts}
        </span>
      </h2>

      <div className="space-y-2">
        {paginatedPetals.map((petal) => (
          <PetalCard key={petal.id} petal={petal} />
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => goToPage(Math.max(1, validPage - 1))}
            disabled={validPage === 1}
            className="p-2 rounded-lg transition-colors disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
            {validPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(Math.min(totalPages, validPage + 1))}
            disabled={validPage === totalPages}
            className="p-2 rounded-lg transition-colors disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
