import { useChatStore } from "../../store/chat-store";
import { PetalCard } from "./petal-card";
import type { Language } from "../../types/chat";

const translations: Record<Language, { contexts: string }> = {
  ja: { contexts: "コンテキスト" },
  zh: { contexts: "上下文" },
  ko: { contexts: "문맥" },
};

export function PetalList() {
  const { selectedFlower, flowerPetals, language } = useChatStore();
  const t = translations[language];

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-medium mb-4" style={{ color: "var(--text)" }}>
        {selectedFlower}
        <span className="text-sm font-normal ml-2" style={{ color: "var(--text-muted)" }}>
          {flowerPetals.length} {t.contexts}
        </span>
      </h2>
      <div className="space-y-3">
        {flowerPetals.map((petal) => (
          <PetalCard key={petal.id} petal={petal} />
        ))}
      </div>
    </div>
  );
}
