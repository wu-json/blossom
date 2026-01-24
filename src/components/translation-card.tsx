import { useState, useEffect, useRef } from "react";
import { Plus, Flower2, X } from "lucide-react";
import { useSmoothText } from "../hooks/use-smooth-text";
import type {
  TranslationData,
  WordBreakdown,
  PartialTranslationData,
  PartialWordBreakdown,
} from "../types/translation";

interface TranslationCardProps {
  data: TranslationData;
  onSaveWord?: (word: WordBreakdown) => Promise<boolean>;
  onRemoveWord?: (word: string) => Promise<boolean>;
  onViewFlower?: (word: string) => void;
  savedWords?: string[];
  showShortcuts?: boolean;
}

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

export function TranslationCard({ data, onSaveWord, onRemoveWord, onViewFlower, savedWords = [], showShortcuts = false }: TranslationCardProps) {
  return (
    <div className="space-y-3">
      {/* Original Text with Subtext */}
      <div>
        <div className="text-lg font-medium leading-relaxed">
          {data.originalText}
        </div>
        <div className="text-sm opacity-60 mt-0.5">{data.subtext}</div>
      </div>

      {/* Translation */}
      <div
        className="px-3 py-2 rounded-lg"
        style={{ backgroundColor: "var(--card-overlay)" }}
      >
        <div className="text-xs font-medium opacity-50 mb-1">Translation</div>
        <div>{data.translation}</div>
      </div>

      {/* Word Breakdown */}
      <div>
        <div className="text-xs font-medium opacity-50 mb-2">Breakdown</div>
        <div className="flex flex-col gap-1">
          {data.breakdown.map((item, idx) => (
            <WordRow
              key={idx}
              item={item}
              isEven={idx % 2 === 0}
              onSave={onSaveWord ? () => onSaveWord(item) : undefined}
              onRemove={onRemoveWord ? () => onRemoveWord(item.word) : undefined}
              onViewFlower={onViewFlower ? () => onViewFlower(item.word) : undefined}
              initialSaved={savedWords.includes(item.word)}
              index={idx}
              showShortcut={showShortcuts}
            />
          ))}
        </div>
      </div>

      {/* Grammar Notes */}
      {data.grammarNotes && (
        <div
          className="pt-3 border-t"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div className="text-xs font-medium opacity-50 mb-1">
            Grammar Notes
          </div>
          <div className="text-sm opacity-90 leading-relaxed">
            {data.grammarNotes}
          </div>
        </div>
      )}
    </div>
  );
}

interface WordRowProps {
  item: WordBreakdown;
  isEven: boolean;
  onSave?: () => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
  onViewFlower?: () => void;
  initialSaved?: boolean;
  index?: number;
  showShortcut?: boolean;
}

// Helper to get the shortcut display for a given index (0-indexed)
function getShortcutDisplay(index: number): { key: string; hasShift: boolean } | null {
  if (index < 0 || index > 18) return null; // Max 19 items (0-18)

  if (index < 9) {
    // Items 1-9: keys 1-9
    return { key: String(index + 1), hasShift: false };
  } else if (index < 18) {
    // Items 10-18: Shift + 1-9
    return { key: String(index - 8), hasShift: true };
  } else {
    // Item 19: Shift + 0
    return { key: "0", hasShift: true };
  }
}

function WordRow({ item, isEven, onSave, onRemove, onViewFlower, initialSaved = false, index, showShortcut = false }: WordRowProps) {
  const color = getPosColor(item.partOfSpeech);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isHovered, setIsHovered] = useState(false);
  const [showBloom, setShowBloom] = useState(false);
  const [showWilt, setShowWilt] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const prevSavedRef = useRef(initialSaved);

  // Sync local state and trigger animations when initialSaved prop changes (e.g., via keyboard shortcut)
  useEffect(() => {
    if (initialSaved !== prevSavedRef.current) {
      setIsSaved(initialSaved);
      if (initialSaved && !prevSavedRef.current) {
        // Was unsaved, now saved -> bloom
        setShowBloom(true);
        setTimeout(() => setShowBloom(false), 500);
      } else if (!initialSaved && prevSavedRef.current) {
        // Was saved, now unsaved -> wilt
        setShowWilt(true);
        setTimeout(() => setShowWilt(false), 400);
      }
      prevSavedRef.current = initialSaved;
    }
  }, [initialSaved]);

  const canInteract = onSave && onRemove;
  const shortcut = index !== undefined ? getShortcutDisplay(index) : null;

  const handleClick = async () => {
    if (!canInteract) return;

    if (isSaved) {
      // Navigate to flower in meadow
      if (onViewFlower) {
        onViewFlower();
      }
    } else {
      // Save the petal and wait for result
      const success = await onSave?.();
      if (success) {
        setIsSaved(true);
        setShowBloom(true);
        setTimeout(() => setShowBloom(false), 500);
      }
      // On failure, isSaved stays false (no UI change)
    }
  };

  const handleRemoveClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    if (!onRemove || !isSaved || isRemoving) return;

    // First click: confirm, second click: remove
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }

    setIsRemoving(true);
    setShowWilt(true);
    const removed = await onRemove();
    if (removed) {
      setTimeout(() => {
        setIsSaved(false);
        setShowWilt(false);
        setIsRemoving(false);
        setConfirmingRemove(false);
      }, 400);
    } else {
      setShowWilt(false);
      setIsRemoving(false);
      setConfirmingRemove(false);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setConfirmingRemove(false);
  };

  return (
    <div
      className={`relative flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 min-w-0 ${canInteract ? "cursor-pointer hover:scale-[1.01]" : ""}`}
      style={{
        backgroundColor: isHovered && canInteract
          ? "var(--card-overlay-hover)"
          : isEven
            ? "var(--card-overlay)"
            : "transparent",
        boxShadow: isHovered && canInteract ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Shortcut indicator */}
      {showShortcut && shortcut && (
        <kbd
          className="flex-shrink-0 h-5 flex items-center justify-center rounded text-[10px] font-mono transition-all gap-0.5"
          style={{
            backgroundColor: "var(--surface-elevated)",
            color: isSaved ? "var(--primary)" : "var(--text-muted)",
            border: "1px solid var(--border)",
            minWidth: shortcut.hasShift ? "32px" : "20px",
          }}
        >
          {shortcut.hasShift && <span style={{ fontSize: "8px" }}>⇧</span>}
          {shortcut.key}
        </kbd>
      )}
      <div className="w-[90px] flex-shrink-0">
        <div className="font-medium leading-tight">{item.word}</div>
        <div className="text-[11px] opacity-50 leading-tight">{item.reading}</div>
      </div>
      <div className="flex-1 min-w-0 text-sm opacity-85">{item.meaning}</div>
      <div
        className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap min-w-[60px] text-center"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {item.partOfSpeech}
      </div>
      {canInteract && (
        <div className="relative flex-shrink-0 flex items-center gap-1">
          {/* Icon with bloom/wilt effect */}
          <div className="relative">
            <div
              className="transition-all duration-150"
              style={{
                color: "var(--primary)",
                opacity: isSaved || isHovered ? 1 : 0,
                transform: showBloom ? "scale(1.4)" : showWilt ? "scale(0.8)" : "scale(1)",
              }}
            >
              {isSaved ? <Flower2 size={16} /> : <Plus size={16} />}
            </div>
            {/* Petal bloom particles */}
            {showBloom && <PetalBloom />}
            {/* Petal wilt particles */}
            {showWilt && <PetalWilt />}
          </div>
          {/* Remove button - only visible on hover when saved */}
          {isSaved && isHovered && (
            <button
              onClick={handleRemoveClick}
              className={`p-1 rounded-full transition-all duration-150 ${confirmingRemove ? "animate-pulse" : ""}`}
              style={{
                color: confirmingRemove ? "#fff" : "var(--text-muted)",
                backgroundColor: confirmingRemove ? "rgba(239, 68, 68, 0.9)" : "transparent",
                opacity: isRemoving ? 0.5 : 1,
                transform: confirmingRemove ? "scale(1.1)" : "scale(1)",
              }}
              title={confirmingRemove ? "Click again to remove" : "Remove from meadow"}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PetalBloom() {
  const petals = [
    { angle: 0, delay: 0 },
    { angle: 60, delay: 25 },
    { angle: 120, delay: 50 },
    { angle: 180, delay: 75 },
    { angle: 240, delay: 100 },
    { angle: 300, delay: 125 },
  ];

  return (
    <div className="absolute inset-0 overflow-visible pointer-events-none">
      {petals.map((petal, i) => (
        <div
          key={i}
          className="petal-particle"
          style={{
            "--petal-angle": `${petal.angle}deg`,
            "--petal-delay": `${petal.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function PetalWilt() {
  const petals = [
    { angle: 30, delay: 0 },
    { angle: 90, delay: 30 },
    { angle: 150, delay: 60 },
  ];

  return (
    <div className="absolute inset-0 overflow-visible pointer-events-none">
      {petals.map((petal, i) => (
        <div
          key={i}
          className="petal-wilt"
          style={{
            "--petal-angle": `${petal.angle}deg`,
            "--petal-delay": `${petal.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function TranslationSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div>
        <div
          className="h-5 w-40 rounded"
          style={{ backgroundColor: "var(--skeleton-bg)" }}
        />
        <div
          className="h-4 w-28 mt-1.5 rounded"
          style={{ backgroundColor: "var(--skeleton-bg)" }}
        />
      </div>
      <div
        className="h-14 rounded-lg"
        style={{ backgroundColor: "var(--card-overlay)" }}
      />
      <div className="flex flex-col gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 rounded-lg"
            style={{ backgroundColor: "var(--card-overlay)" }}
          />
        ))}
      </div>
    </div>
  );
}

// Streaming components

interface StreamingTranslationCardProps {
  data: PartialTranslationData;
}

export function StreamingTranslationCard({ data }: StreamingTranslationCardProps) {
  const isFieldStreaming = (field: string) =>
    data._streaming?.currentField === field && !data._streaming?.isComplete;

  return (
    <div className="space-y-3">
      {/* Original Text with Subtext */}
      <div>
        {data.originalText !== undefined ? (
          <>
            <div className="text-lg font-medium leading-relaxed">
              {data.originalText}
              {isFieldStreaming("originalText") && <StreamingCursor />}
            </div>
            {data.subtext !== undefined ? (
              <div className="text-sm opacity-60 mt-0.5">
                {data.subtext}
                {isFieldStreaming("subtext") && <StreamingCursor />}
              </div>
            ) : (
              <FieldSkeleton width="w-28" height="h-4" className="mt-1.5" />
            )}
          </>
        ) : (
          <>
            <FieldSkeleton width="w-40" height="h-5" />
            <FieldSkeleton width="w-28" height="h-4" className="mt-1.5" />
          </>
        )}
      </div>

      {/* Translation */}
      <div
        className="px-3 py-2 rounded-lg"
        style={{ backgroundColor: "var(--card-overlay)" }}
      >
        <div className="text-xs font-medium opacity-50 mb-1">Translation</div>
        {data.translation !== undefined ? (
          <div>
            {data.translation}
            {isFieldStreaming("translation") && <StreamingCursor />}
          </div>
        ) : (
          <FieldSkeleton width="w-full" height="h-5" />
        )}
      </div>

      {/* Word Breakdown */}
      <div>
        <div className="text-xs font-medium opacity-50 mb-2">Breakdown</div>
        <div className="flex flex-col gap-1">
          {data.breakdown && data.breakdown.length > 0 && (
            <>
              {data.breakdown.map((item, idx) => (
                <StreamingWordRow
                  key={idx}
                  item={item}
                  isEven={idx % 2 === 0}
                  isStreaming={
                    isFieldStreaming("breakdown") &&
                    idx === data.breakdown!.length - 1
                  }
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Grammar Notes */}
      {data.grammarNotes !== undefined && (
        <div
          className="pt-3 border-t"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div className="text-xs font-medium opacity-50 mb-1">Grammar Notes</div>
          <div className="text-sm opacity-90 leading-relaxed">
            {data.grammarNotes}
            {isFieldStreaming("grammarNotes") && <StreamingCursor />}
          </div>
        </div>
      )}
    </div>
  );
}

interface StreamingWordRowProps {
  item: PartialWordBreakdown;
  isEven: boolean;
  isStreaming: boolean;
}

function StreamingWordRow({ item, isEven, isStreaming }: StreamingWordRowProps) {
  // Animate each field with typewriter effect
  const displayedWord = useSmoothText(item.word ?? "", isStreaming && !!item.word);
  const displayedReading = useSmoothText(item.reading ?? "", isStreaming && !!item.reading);
  const displayedMeaning = useSmoothText(item.meaning ?? "", isStreaming && !!item.meaning);
  const displayedPos = useSmoothText(item.partOfSpeech ?? "", isStreaming && !!item.partOfSpeech);

  // Track completion for cursor placement
  const isWordComplete = displayedWord === (item.word ?? "");
  const isReadingComplete = displayedReading === (item.reading ?? "");
  const isMeaningComplete = displayedMeaning === (item.meaning ?? "");
  const isPosComplete = displayedPos === (item.partOfSpeech ?? "");

  const color = displayedPos ? getPosColor(displayedPos) : "#6B7280";

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md min-w-0"
      style={{
        backgroundColor: isEven
          ? "var(--card-overlay)"
          : "transparent",
      }}
    >
      <div className="w-[90px] flex-shrink-0">
        {displayedWord ? (
          <div className="font-medium leading-tight">
            {displayedWord}
            {isStreaming && !isWordComplete && <StreamingCursor />}
          </div>
        ) : (
          <FieldSkeleton width="w-12" height="h-4" />
        )}
        {displayedReading ? (
          <div className="text-[11px] opacity-50 leading-tight">
            {displayedReading}
            {isStreaming && isWordComplete && !isReadingComplete && <StreamingCursor />}
          </div>
        ) : (
          <FieldSkeleton width="w-10" height="h-3" className="mt-0.5" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-sm opacity-85">
        {displayedMeaning ? (
          <>
            {displayedMeaning}
            {isStreaming && isReadingComplete && !isMeaningComplete && <StreamingCursor />}
          </>
        ) : (
          <FieldSkeleton width="w-20" height="h-4" />
        )}
      </div>
      {displayedPos ? (
        <div
          className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap min-w-[60px] text-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {displayedPos}
          {isStreaming && isMeaningComplete && !isPosComplete && <StreamingCursor />}
        </div>
      ) : (
        <div
          className="w-[60px] h-5 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--skeleton-bg)" }}
        />
      )}
      {/* Spacer to match WordRow icon area */}
      <div className="w-4 flex-shrink-0" />
    </div>
  );
}

function StreamingCursor() {
  return (
    <span
      className="inline-block w-[2px] h-[1em] ml-0.5 align-middle animate-pulse"
      style={{ backgroundColor: "currentColor", opacity: 0.7 }}
    />
  );
}

function FieldSkeleton({
  width,
  height,
  className = "",
}: {
  width: string;
  height: string;
  className?: string;
}) {
  return (
    <div
      className={`${width} ${height} rounded animate-pulse ${className}`}
      style={{ backgroundColor: "var(--skeleton-bg)" }}
    />
  );
}

function BreakdownItemSkeleton() {
  return (
    <div
      className="h-10 rounded-lg animate-pulse"
      style={{ backgroundColor: "var(--card-overlay)" }}
    />
  );
}
