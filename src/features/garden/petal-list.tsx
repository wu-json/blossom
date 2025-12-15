import { useState, useEffect } from "react";
import { useChatStore } from "../../store/chat-store";
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
  const t = translations[language];
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when flower changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFlower]);

  // Calculate pagination
  const totalPages = Math.ceil(flowerPetals.length / PETALS_PER_PAGE);
  const startIndex = (currentPage - 1) * PETALS_PER_PAGE;
  const paginatedPetals = flowerPetals.slice(startIndex, startIndex + PETALS_PER_PAGE);

  return (
    <div className="w-full">
      <h2 className="text-xl font-medium mb-4" style={{ color: "var(--text)" }}>
        {selectedFlower}
        <span className="text-sm font-normal ml-2" style={{ color: "var(--text-muted)" }}>
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
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg transition-colors disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
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
