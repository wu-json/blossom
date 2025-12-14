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
  const { deletePetal, selectConversation, setView, language } = useChatStore();
  const t = translations[language];

  const handleViewContext = async () => {
    await selectConversation(petal.conversationId);
    setView("chat");
  };

  const handleDelete = async () => {
    await deletePetal(petal.id);
  };

  return (
    <div
      className="p-4 rounded-lg border"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* User input context */}
      <div
        className="text-sm mb-3 p-3 rounded-lg"
        style={{ backgroundColor: "var(--background)" }}
      >
        <span style={{ color: "var(--text-muted)" }}>"{petal.userInput}"</span>
      </div>

      {/* Word details */}
      <div className="flex items-center gap-3 mb-3">
        <div>
          <span className="font-medium" style={{ color: "var(--text)" }}>{petal.word}</span>
          {petal.reading && (
            <span className="text-sm ml-2" style={{ color: "var(--text-muted)" }}>{petal.reading}</span>
          )}
        </div>
        {petal.meaning && (
          <>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>-</span>
            <span className="text-sm" style={{ color: "var(--text)" }}>{petal.meaning}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={handleViewContext}
          className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          <ExternalLink size={14} />
          {t.viewContext}
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-xs text-red-500 transition-colors hover:opacity-80"
        >
          <Trash2 size={14} />
          {t.delete}
        </button>
      </div>
    </div>
  );
}
