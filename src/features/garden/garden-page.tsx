import { useEffect } from "react";
import { MenuIcon } from "../../components/icons/menu-icon";
import { HeaderControls } from "../../components/ui/header-controls";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import { version } from "../../generated/version";
import { FlowerList } from "./flower-list";
import { PetalList } from "./petal-list";
import { ArrowLeft } from "lucide-react";
import type { Language } from "../../types/chat";

const translations: Record<Language, {
  garden: string;
  noFlowers: string;
  noFlowersHint: string;
  backToFlowers: string;
  startChat: string;
}> = {
  ja: {
    garden: "花園",
    noFlowers: "あなたの花園",
    noFlowersHint: "会話の中で出会った言葉を保存して、ここで振り返りましょう",
    backToFlowers: "戻る",
    startChat: "会話を始める",
  },
  zh: {
    garden: "花园",
    noFlowers: "你的花园",
    noFlowersHint: "保存对话中遇到的词汇，在这里复习",
    backToFlowers: "返回",
    startChat: "开始对话",
  },
  ko: {
    garden: "정원",
    noFlowers: "나의 정원",
    noFlowersHint: "대화에서 만난 단어를 저장하고 여기서 복습하세요",
    backToFlowers: "돌아가기",
    startChat: "대화 시작",
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
  } = useChatStore();
  const { navigateToGarden, navigateToChat } = useNavigation();

  const t = translations[language];

  useEffect(() => {
    loadFlowers();
  }, [language, loadFlowers]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--background)" }}>
      <header
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center">
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
              onClick={() => navigateToGarden()}
              className="ml-4 flex items-center gap-1 text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--primary)" }}
            >
              <ArrowLeft size={16} />
              {t.backToFlowers}
            </button>
          )}
        </div>

        <HeaderControls />
      </header>

      <main className="flex-1 flex flex-col overflow-auto p-6">
        {selectedFlower ? (
          <PetalList />
        ) : flowers.length > 0 ? (
          <FlowerList />
        ) : (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
            style={{ animation: "fadeIn 0.5s ease-out" }}
          >
            {/* Animated flower illustration */}
            <div
              className="relative"
              style={{ animation: "float 4s ease-in-out infinite" }}
            >
              {/* Soft glow background */}
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{
                  background: "var(--primary)",
                  animation: "breathe 4s ease-in-out infinite",
                  transform: "scale(1.5)",
                }}
              />
              {/* Flower SVG */}
              <svg
                width="64"
                height="64"
                viewBox="0 0 80 80"
                fill="none"
                className="relative"
              >
                {/* Petals */}
                {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                  <ellipse
                    key={i}
                    cx="40"
                    cy="40"
                    rx="12"
                    ry="20"
                    fill="var(--primary)"
                    opacity={0.7 + (i % 2) * 0.15}
                    transform={`rotate(${angle} 40 40) translate(0 -16)`}
                  />
                ))}
                {/* Center */}
                <circle cx="40" cy="40" r="10" fill="var(--primary-hover)" />
              </svg>
            </div>

            {/* Text content */}
            <div className="text-center">
              <h2
                className="text-lg font-semibold mb-1"
                style={{ color: "var(--text)" }}
              >
                {t.noFlowers}
              </h2>
              <p
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {t.noFlowersHint}
              </p>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => navigateToChat()}
              className="px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: "var(--primary)",
                color: "white",
              }}
            >
              {t.startChat}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
