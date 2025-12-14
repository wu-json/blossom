import type { Flower } from "../../types/chat";
import { Flower as FlowerIcon } from "lucide-react";

interface FlowerCardProps {
  flower: Flower;
  onClick: () => void;
}

export function FlowerCard({ flower, onClick }: FlowerCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-lg border text-left transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "var(--primary-light)" }}
        >
          <FlowerIcon size={20} style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-base" style={{ color: "var(--text)" }}>
            {flower.word}
          </div>
          <div className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
            {flower.latestReading} - {flower.latestMeaning}
          </div>
        </div>
        <div
          className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
          style={{ backgroundColor: "var(--primary)", color: "white" }}
        >
          {flower.petalCount}
        </div>
      </div>
    </button>
  );
}
