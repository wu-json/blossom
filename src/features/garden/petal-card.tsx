import { useState, useEffect } from "react";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import type { Petal, Language } from "../../types/chat";
import type { TranslationData, WordBreakdown } from "../../types/translation";
import { Trash2, ExternalLink } from "lucide-react";

const translations: Record<Language, { viewContext: string; delete: string; confirmDelete: string }> = {
  ja: { viewContext: "会話を見る", delete: "削除", confirmDelete: "確認" },
  zh: { viewContext: "查看对话", delete: "删除", confirmDelete: "确认" },
  ko: { viewContext: "대화 보기", delete: "삭제", confirmDelete: "확인" },
};

const posColors: Record<string, string> = {
  noun: "#3B82F6",
  verb: "#10B981",
  adjective: "#F59E0B",
  particle: "#8B5CF6",
  adverb: "#EC4899",
  conjunction: "#06B6D4",
  auxiliary: "#F97316",
};

function getPosColor(partOfSpeech: string): string {
  const lower = partOfSpeech.toLowerCase();
  for (const [key, color] of Object.entries(posColors)) {
    if (lower.includes(key)) return color;
  }
  return "#6B7280";
}

interface PetalCardProps {
  petal: Petal;
}

export function PetalCard({ petal }: PetalCardProps) {
  const { deletePetal, setScrollToMessage, language } = useChatStore();
  const { navigateToChat } = useNavigation();
  const t = translations[language];
  const [translationData, setTranslationData] = useState<TranslationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const fetchTranslation = async () => {
      try {
        const response = await fetch(
          `/api/messages/${petal.conversationId}/${petal.messageId}/translation`
        );
        if (response.ok) {
          const data = await response.json();
          setTranslationData(data);
        }
      } catch (error) {
        console.error("Failed to fetch translation:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTranslation();
  }, [petal.conversationId, petal.messageId]);

  const handleViewContext = () => {
    setScrollToMessage(petal.messageId);
    navigateToChat(petal.conversationId);
  };

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await deletePetal(petal.id);
    setConfirmingDelete(false);
  };

  const hasImages = petal.userImages && petal.userImages.length > 0;
  const hasText = petal.userInput && petal.userInput.trim().length > 0;

  return (
    <div
      className="rounded-lg border overflow-hidden group"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* User context - original text/images */}
      {(hasImages || hasText) && (
        <div
          className="px-4 py-3 border-b"
          style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
        >
          {hasImages && (
            <div className="flex flex-wrap gap-2 mb-2">
              {petal.userImages!.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Context ${idx + 1}`}
                  className="max-h-96 w-auto object-contain rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => window.open(url, "_blank")}
                />
              ))}
            </div>
          )}
          {hasText && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              "{petal.userInput}"
            </p>
          )}
        </div>
      )}

      {/* Full breakdown */}
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-5 w-32 rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="h-4 w-full rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded" style={{ backgroundColor: "var(--border)" }} />
              ))}
            </div>
          </div>
        ) : translationData ? (
          <>
            {/* Original Text */}
            <div>
              <div className="text-base font-medium" style={{ color: "var(--text)" }}>
                {translationData.originalText}
              </div>
              {translationData.subtext && (
                <div className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {translationData.subtext}
                </div>
              )}
            </div>

            {/* Translation */}
            <div
              className="px-3 py-2 rounded-lg"
              style={{ backgroundColor: "var(--background)" }}
            >
              <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                Translation
              </div>
              <div className="text-sm" style={{ color: "var(--text)" }}>
                {translationData.translation}
              </div>
            </div>

            {/* Word Breakdown */}
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                Breakdown
              </div>
              <div className="flex flex-col gap-1">
                {translationData.breakdown.map((item, idx) => (
                  <WordRow
                    key={idx}
                    item={item}
                    isEven={idx % 2 === 0}
                    isHighlighted={item.word === petal.word}
                  />
                ))}
              </div>
            </div>

            {/* Grammar Notes */}
            {translationData.grammarNotes && (
              <div
                className="pt-3 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                  Grammar Notes
                </div>
                <div className="text-sm" style={{ color: "var(--text)" }}>
                  {translationData.grammarNotes}
                </div>
              </div>
            )}
          </>
        ) : (
          // Fallback to basic petal info if translation not found
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {petal.word}
              </span>
              {petal.reading && petal.reading !== petal.word && (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {petal.reading}
                </span>
              )}
              {petal.partOfSpeech && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  ({petal.partOfSpeech})
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {petal.meaning}
            </p>
          </div>
        )}

        {/* Actions + Date */}
        <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={handleViewContext}
            className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
            style={{ color: "var(--primary)" }}
          >
            <ExternalLink size={14} />
            {t.viewContext}
          </button>
          <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
            {new Date(petal.createdAt).toLocaleDateString(language === "ja" ? "ja-JP" : language === "zh" ? "zh-CN" : "ko-KR", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
          <button
            onClick={handleDelete}
            onBlur={() => setConfirmingDelete(false)}
            className={`flex items-center gap-1.5 text-xs transition-all ${
              confirmingDelete
                ? "bg-red-500 text-white px-2 py-1 rounded-md"
                : "text-red-500 hover:opacity-80"
            }`}
          >
            <Trash2 size={14} />
            {confirmingDelete ? t.confirmDelete : t.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

interface WordRowProps {
  item: WordBreakdown;
  isEven: boolean;
  isHighlighted: boolean;
}

function WordRow({ item, isEven, isHighlighted }: WordRowProps) {
  const color = getPosColor(item.partOfSpeech);

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md"
      style={{
        backgroundColor: isHighlighted
          ? "var(--primary-light)"
          : isEven
            ? "rgba(128, 128, 128, 0.05)"
            : "rgba(128, 128, 128, 0.1)",
        border: isHighlighted ? "1px solid var(--primary)" : "1px solid transparent",
      }}
    >
      <div className="w-[90px] flex-shrink-0">
        <div className="font-medium leading-tight" style={{ color: "var(--text)" }}>
          {item.word}
        </div>
        <div className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
          {item.reading}
        </div>
      </div>
      <div className="flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {item.meaning}
      </div>
      <div
        className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap min-w-[60px] text-center"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {item.partOfSpeech}
      </div>
    </div>
  );
}
