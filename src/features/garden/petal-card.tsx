import { useChatStore } from "../../store/chat-store";
import type { Petal, Language } from "../../types/chat";
import { Trash2, ExternalLink } from "lucide-react";

const translations: Record<Language, { viewContext: string; delete: string }> = {
  ja: { viewContext: "会話を見る", delete: "削除" },
  zh: { viewContext: "查看对话", delete: "删除" },
  ko: { viewContext: "대화 보기", delete: "삭제" },
};

interface PetalCardProps {
  petal: Petal;
}

export function PetalCard({ petal }: PetalCardProps) {
  const { deletePetal, selectConversation, setView, setScrollToMessage, language } = useChatStore();
  const t = translations[language];

  const handleViewContext = async () => {
    setScrollToMessage(petal.messageId);
    await selectConversation(petal.conversationId);
    setView("chat");
  };

  const handleDelete = async () => {
    await deletePetal(petal.id);
  };

  const hasImages = petal.userImages && petal.userImages.length > 0;
  const hasText = petal.userInput && petal.userInput.trim().length > 0;
  const hasContext = hasImages || hasText;

  // Build context tooltip
  const contextTooltip = hasText ? `"${petal.userInput}"` : hasImages ? `${petal.userImages!.length} image(s)` : "";

  return (
    <div
      className="flex items-center gap-4 py-3 px-4 rounded-lg border transition-colors group hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Context indicator */}
      <div className="w-5 flex-shrink-0 flex justify-center">
        {hasContext && (
          <div
            className="w-1.5 h-1.5 rounded-full opacity-60"
            style={{ backgroundColor: "var(--primary)" }}
            title={contextTooltip}
          />
        )}
      </div>

      {/* Word + Reading */}
      <div className="w-28 flex-shrink-0">
        <span className="font-medium" style={{ color: "var(--text)" }}>{petal.word}</span>
        {petal.reading && petal.reading !== petal.word && (
          <span className="text-xs ml-1.5" style={{ color: "var(--text-muted)" }}>{petal.reading}</span>
        )}
      </div>

      {/* Meaning */}
      <div className="flex-1 min-w-0">
        <span
          className="text-sm truncate block"
          style={{ color: "var(--text-muted)" }}
          title={petal.meaning}
        >
          {petal.meaning}
        </span>
      </div>

      {/* Actions - visible on hover */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleViewContext}
          className="p-1.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: "var(--primary)" }}
          title={t.viewContext}
        >
          <ExternalLink size={14} />
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded text-red-500 transition-colors hover:bg-red-500/10"
          title={t.delete}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
