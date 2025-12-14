import { useState } from "react";
import { Plus, Check } from "lucide-react";
import type {
  TranslationData,
  WordBreakdown,
  PartialTranslationData,
  PartialWordBreakdown,
} from "../types/translation";

interface TranslationCardProps {
  data: TranslationData;
  onSaveWord?: (word: WordBreakdown) => void;
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

export function TranslationCard({ data, onSaveWord }: TranslationCardProps) {
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
        style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
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
            />
          ))}
        </div>
      </div>

      {/* Grammar Notes */}
      {data.grammarNotes && (
        <div
          className="pt-3 border-t"
          style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
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
  onSave?: () => void;
}

function WordRow({ item, isEven, onSave }: WordRowProps) {
  const color = getPosColor(item.partOfSpeech);
  const [isSaved, setIsSaved] = useState(false);

  const handleClick = () => {
    if (onSave && !isSaved) {
      onSave();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${onSave ? "cursor-pointer group" : ""}`}
      style={{
        backgroundColor: isEven
          ? "rgba(255, 255, 255, 0.03)"
          : "rgba(255, 255, 255, 0.06)",
      }}
      onClick={handleClick}
    >
      <div className="w-[90px] flex-shrink-0">
        <div className="font-medium leading-tight">{item.word}</div>
        <div className="text-[11px] opacity-50 leading-tight">{item.reading}</div>
      </div>
      <div className="flex-1 text-sm opacity-85">{item.meaning}</div>
      <div
        className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap min-w-[60px] text-center"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {item.partOfSpeech}
      </div>
      {onSave && (
        <div
          className={`flex-shrink-0 transition-opacity ${isSaved ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          style={{ color: isSaved ? "#22c55e" : "var(--primary)" }}
        >
          {isSaved ? <Check size={16} /> : <Plus size={16} />}
        </div>
      )}
    </div>
  );
}

export function TranslationSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div>
        <div
          className="h-5 w-40 rounded"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
        />
        <div
          className="h-4 w-28 mt-1.5 rounded"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
        />
      </div>
      <div
        className="h-14 rounded-lg"
        style={{ backgroundColor: "rgba(255, 255, 255, 0.06)" }}
      />
      <div className="flex flex-col gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 rounded-lg"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.06)" }}
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
        style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
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
          {data.breakdown && data.breakdown.length > 0 ? (
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
          ) : (
            <>
              <BreakdownItemSkeleton />
              <BreakdownItemSkeleton />
              <BreakdownItemSkeleton />
            </>
          )}
        </div>
      </div>

      {/* Grammar Notes */}
      {data.grammarNotes !== undefined && (
        <div
          className="pt-3 border-t"
          style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
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
  const color = item.partOfSpeech ? getPosColor(item.partOfSpeech) : "#6B7280";

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md"
      style={{
        backgroundColor: isEven
          ? "rgba(255, 255, 255, 0.03)"
          : "rgba(255, 255, 255, 0.06)",
      }}
    >
      <div className="w-[90px] flex-shrink-0">
        {item.word ? (
          <div className="font-medium leading-tight">{item.word}</div>
        ) : (
          <FieldSkeleton width="w-12" height="h-4" />
        )}
        {item.reading ? (
          <div className="text-[11px] opacity-50 leading-tight">{item.reading}</div>
        ) : (
          <FieldSkeleton width="w-10" height="h-3" className="mt-0.5" />
        )}
      </div>
      <div className="flex-1 text-sm opacity-85">
        {item.meaning ? (
          <>
            {item.meaning}
            {isStreaming && !item.partOfSpeech && <StreamingCursor />}
          </>
        ) : (
          <FieldSkeleton width="w-20" height="h-4" />
        )}
      </div>
      {item.partOfSpeech ? (
        <div
          className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap min-w-[60px] text-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {item.partOfSpeech}
        </div>
      ) : (
        <div
          className="w-[60px] h-5 rounded-full animate-pulse"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
        />
      )}
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
      style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
    />
  );
}

function BreakdownItemSkeleton() {
  return (
    <div
      className="h-10 rounded-lg animate-pulse"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.06)" }}
    />
  );
}
