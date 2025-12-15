import { useEffect } from "react";
import { MenuIcon } from "../../components/icons/menu-icon";
import { useChatStore } from "../../store/chat-store";
import { version } from "../../version";
import { FlowerList } from "./flower-list";
import { PetalList } from "./petal-list";
import { ArrowLeft } from "lucide-react";
import type { Language } from "../../types/chat";

const translations: Record<Language, {
  garden: string;
  noFlowers: string;
  noFlowersHint: string;
  backToFlowers: string;
}> = {
  ja: {
    garden: "花園",
    noFlowers: "まだ花がありません",
    noFlowersHint: "チャットの翻訳から単語をクリックして保存しましょう",
    backToFlowers: "戻る",
  },
  zh: {
    garden: "花园",
    noFlowers: "还没有花",
    noFlowersHint: "点击聊天翻译中的单词来保存",
    backToFlowers: "返回",
  },
  ko: {
    garden: "정원",
    noFlowers: "아직 꽃이 없습니다",
    noFlowersHint: "채팅 번역에서 단어를 클릭하여 저장하세요",
    backToFlowers: "돌아가기",
  },
};

export function GardenPage() {
  const {
    toggleSidebar,
    sidebarCollapsed,
    language,
    flowers,
    selectedFlower,
    loadFlowers,
    clearSelectedFlower,
  } = useChatStore();

  const t = translations[language];

  useEffect(() => {
    loadFlowers();
  }, [language, loadFlowers]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--background)" }}>
      <header
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
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
          <span className="text-xs self-end mb-[2px]" style={{ color: "var(--text-muted)" }}>
            v{version}
          </span>
        </button>

        {selectedFlower && (
          <button
            onClick={clearSelectedFlower}
            className="ml-4 flex items-center gap-1 text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--primary)" }}
          >
            <ArrowLeft size={16} />
            {t.backToFlowers}
          </button>
        )}
      </header>

      <main className="flex-1 overflow-auto p-6">
        {selectedFlower ? (
          <PetalList />
        ) : flowers.length > 0 ? (
          <FlowerList />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="text-4xl mb-4"
              style={{ opacity: 0.3 }}
            >
              🌸
            </div>
            <p className="text-base font-medium" style={{ color: "var(--text)" }}>
              {t.noFlowers}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {t.noFlowersHint}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
