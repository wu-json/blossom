import { useState, useRef } from "react";
import type { TranslateRegion } from "../../store/youtube-store";
import type { Language } from "../../types/chat";

interface RegionSelectorProps {
  frameImageUrl: string;
  initialRegion?: TranslateRegion;
  language: Language;
  translations: {
    selectRegion: string;
    selectRegionDesc: string;
    regionTooSmall: string;
  };
  onConfirm: (region: TranslateRegion) => void;
  onCancel: () => void;
}

export function RegionSelector({
  frameImageUrl,
  initialRegion,
  translations,
  onConfirm,
  onCancel,
}: RegionSelectorProps) {
  const [region, setRegion] = useState<TranslateRegion | null>(initialRegion ?? null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setRegion(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !startPoint || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setRegion({
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y),
    });
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    setStartPoint(null);
  };

  const isRegionValid = region && region.width >= 0.05 && region.height >= 0.05;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
    >
      <div
        className="flex flex-col max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--text)" }}
          >
            {translations.selectRegion}
          </h3>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {translations.selectRegionDesc}
          </p>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative cursor-crosshair select-none touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            src={frameImageUrl}
            alt="Video frame"
            className="block max-w-full max-h-[70vh]"
            draggable={false}
          />

          {/* Darkened mask with cutout for selection */}
          {region && (
            <div
              className="absolute border-2 rounded"
              style={{
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
                borderColor: "var(--primary)",
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
              }}
            />
          )}
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            {region && !isRegionValid && translations.regionTooSmall}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => region && onConfirm(region)}
              disabled={!isRegionValid}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
              style={{
                backgroundColor: "var(--primary)",
                color: "white",
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
