import type { TranslationData, WordBreakdown } from "../types/translation";

interface TranslationCardProps {
  data: TranslationData;
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

export function TranslationCard({ data }: TranslationCardProps) {
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
        <div className="flex flex-col gap-1.5">
          {data.breakdown.map((item, idx) => (
            <WordRow key={idx} item={item} />
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
}

function WordRow({ item }: WordRowProps) {
  const color = getPosColor(item.partOfSpeech);

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
    >
      <div className="min-w-[60px]">
        <div className="font-medium">{item.word}</div>
        <div className="text-xs opacity-60">{item.reading}</div>
      </div>
      <div className="flex-1 text-sm opacity-90">{item.meaning}</div>
      <div
        className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
        style={{ backgroundColor: `${color}25`, color }}
      >
        {item.partOfSpeech}
      </div>
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
