# Translate Region Feature

**Date:** 2025-01-23
**Status:** Draft

## Overview

The Translate Region feature allows users to define a specific area of the video frame for OCR translation. When enabled, only the selected region is sent to the LLM for processing, reducing noise from other text visible in the frame (UI elements, unrelated captions, signs, etc.) and improving translation accuracy for the target text.

## Problem

Currently, the YouTube viewer captures the entire video frame and sends it to the LLM for translation. This causes issues when:

1. **Multiple text sources**: The frame contains subtitles, on-screen text, UI elements, watermarks, etc. The LLM may translate the wrong text or return a cluttered response with multiple translations.
2. **Inconsistent results**: Without guidance on which text to focus on, the LLM's choice of what to translate varies between frames.
3. **Noise in responses**: Users receive translations they didn't want (e.g., channel watermarks, video titles burned into the frame).

## Solution

Add a "Translate Region" mode with:

1. **Toggle switch**: Enable/disable region-based translation
2. **Adjust Region button**: Opens a region selection overlay on the current frame
3. **Persistent region**: Once set, the region is saved per-video and reused for subsequent translations
4. **Cropped LLM input**: When enabled, only the cropped region is sent to the LLM
5. **Full image storage**: The full frame is still saved to the database for context/history

## User Flow

### Setting Up a Region

1. User loads a YouTube video in the viewer
2. User pauses at a frame with visible text they want to translate
3. User clicks "Adjust Region" button
4. An overlay appears showing the current frame
5. User draws a bounding box around the target text area (e.g., subtitle region)
6. User confirms the selection
7. The region is saved and the toggle is automatically enabled

### Using the Region

1. User has a region configured and toggle is ON
2. User clicks "Translate Frame"
3. System captures full frame, crops to the saved region, sends cropped image to LLM
4. Translation is returned and displayed
5. Full frame (not cropped) is saved to `youtube_translations` table

### Disabling the Region

1. User turns off the "Translate Region" toggle
2. System reverts to sending the full frame to LLM
3. The saved region is preserved for later use

## Technical Design

### State Management

Extend the YouTube store to track region settings per video. Follow the existing store pattern in `src/store/youtube-store.ts`:

```typescript
// Types to add
interface TranslateRegion {
  x: number;      // Left offset (0-1, percentage of frame width)
  y: number;      // Top offset (0-1, percentage of frame height)
  width: number;  // Region width (0-1, percentage)
  height: number; // Region height (0-1, percentage)
}

interface VideoRegionSettings {
  [videoId: string]: TranslateRegion;
}

// Add to YouTubeState interface
interface YouTubeState {
  // ... existing state (videoUrl, videoId, isExtracting, isTranslating, etc.) ...

  // New region state
  translateRegionEnabled: boolean;
  videoRegions: VideoRegionSettings;  // Persisted
  isAdjustingRegion: boolean;         // Transient UI state
}

// Add to YouTubeActions interface
interface YouTubeActions {
  // ... existing actions ...

  setTranslateRegionEnabled: (enabled: boolean) => void;
  setVideoRegion: (videoId: string, region: TranslateRegion) => void;
  clearVideoRegion: (videoId: string) => void;
  setIsAdjustingRegion: (isAdjusting: boolean) => void;
}
```

Using normalized coordinates (0-1) ensures the region scales correctly regardless of the actual frame resolution returned by ffmpeg.

### Persistence

Region settings are persisted to localStorage via Zustand's persist middleware. Update the `partialize` function to include region data:

```typescript
// In useYouTubeStore create()
persist(
  (set) => ({ /* ... */ }),
  {
    name: "blossom-youtube-ui",
    partialize: (state) => ({
      // Existing persisted fields
      translationBarWidth: state.translationBarWidth,
      translationBarCollapsed: state.translationBarCollapsed,
      playerHeight: state.playerHeight,
      // New persisted fields
      translateRegionEnabled: state.translateRegionEnabled,
      videoRegions: state.videoRegions,
    }),
  }
)
```

The `videoRegions` map uses video IDs as keys, so each video can have its own region.

### Internationalization

Add translation strings to the `translations` record in `youtube-viewer.tsx`:

```typescript
const translations: Record<Language, { /* existing */ region: string; setRegion: string; adjustRegion: string; selectRegion: string; selectRegionDesc: string; regionTooSmall: string; }> = {
  ja: {
    // ... existing strings ...
    region: "領域",
    setRegion: "領域を設定",
    adjustRegion: "領域を調整",
    selectRegion: "翻訳領域を選択",
    selectRegionDesc: "翻訳したいテキストの周りにボックスを描く",
    regionTooSmall: "領域が小さすぎます",
  },
  zh: {
    region: "区域",
    setRegion: "设置区域",
    adjustRegion: "调整区域",
    selectRegion: "选择翻译区域",
    selectRegionDesc: "在要翻译的文字周围画一个框",
    regionTooSmall: "区域太小",
  },
  ko: {
    region: "영역",
    setRegion: "영역 설정",
    adjustRegion: "영역 조정",
    selectRegion: "번역 영역 선택",
    selectRegionDesc: "번역할 텍스트 주위에 상자를 그리세요",
    regionTooSmall: "영역이 너무 작습니다",
  },
};
```

### UI Components

#### Control Bar

Add region toggle and adjust button in the controls bar (alongside Share and Translate buttons). The codebase uses inline styles with CSS variables combined with Tailwind utility classes:

```
+------------------------------------------+
| [X] Title  [Region: ON] [Adjust] [Share] [Translate] |
+------------------------------------------+
```

```typescript
// In youtube-viewer.tsx controls section, add before the Share button

{/* Region toggle - only show when a region is set */}
{currentVideoRegion && (
  <button
    onClick={() => setTranslateRegionEnabled(!translateRegionEnabled)}
    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-all"
    style={{
      backgroundColor: translateRegionEnabled ? "var(--primary)" : "var(--surface)",
      color: translateRegionEnabled ? "white" : "var(--text-muted)",
      border: translateRegionEnabled ? "none" : "1px solid var(--border)",
    }}
    title={translateRegionEnabled ? "Region cropping enabled" : "Region cropping disabled"}
  >
    <Crop size={14} />
    {translations[language].region}
  </button>
)}

{/* Set/Adjust region button */}
<button
  onClick={handleAdjustRegion}
  disabled={isExtracting || isTranslating}
  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
  style={{
    backgroundColor: "var(--surface)",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
  }}
>
  <ScanLine size={14} />
  {currentVideoRegion ? translations[language].adjustRegion : translations[language].setRegion}
</button>
```

Icons to import from `lucide-react`: `Crop`, `ScanLine` (or `Focus`, `Scan`).

#### Region Selection Overlay

A modal overlay that displays the current frame and allows drawing a bounding box. Create as `src/features/youtube/region-selector.tsx`:

```typescript
interface RegionSelectorProps {
  frameImageUrl: string;  // URL from /api/youtube/frames/:filename
  initialRegion?: TranslateRegion;
  language: Language;
  onConfirm: (region: TranslateRegion) => void;
  onCancel: () => void;
}

function RegionSelector({
  frameImageUrl,
  initialRegion,
  language,
  onConfirm,
  onCancel
}: RegionSelectorProps) {
  const [region, setRegion] = useState<TranslateRegion | null>(initialRegion ?? null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use pointer events for mouse + touch support (pattern from use-draggable-marker.ts)
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
            {translations[language].selectRegion}
          </h3>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {translations[language].selectRegionDesc}
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
          className="flex justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
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
  );
}
```

#### Visual Feedback

When the toggle is ON and a region is set, show a subtle indicator on the video player:

```typescript
// Optional: overlay showing the active region boundary on the player
{translateRegionEnabled && currentVideoRegion && (
  <div
    className="region-indicator"
    style={{
      left: `${currentVideoRegion.x * 100}%`,
      top: `${currentVideoRegion.y * 100}%`,
      width: `${currentVideoRegion.width * 100}%`,
      height: `${currentVideoRegion.height * 100}%`,
    }}
  />
)}
```

### Frame Capture Flow

The existing flow extracts frames server-side via yt-dlp/ffmpeg and saves them to `~/.blossom/frames/`. The translate endpoint receives a filename, not base64. Modify to handle region cropping:

```typescript
// In youtube-viewer.tsx - modify handleTranslateFrame()

const handleTranslateFrame = async () => {
  if (!videoId || !playerRef.current) return;

  const timestamp = playerRef.current.getCurrentTime();
  setCurrentTimestamp(timestamp);
  setExtracting(true);
  setError(null);

  let frameFilename: string | null = null;

  try {
    // 1. Extract full frame (existing behavior - saves to disk)
    const extractResponse = await fetch("/api/youtube/extract-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, timestamp }),
    });

    if (!extractResponse.ok) {
      throw new Error((await extractResponse.json()).error || "Failed to extract frame");
    }

    const extractData = await extractResponse.json();
    frameFilename = extractData.filename;
    setExtracting(false);
    setTranslating(true);

    // 2. Get current region for this video (if enabled)
    const currentVideoRegion = videoRegions[videoId];
    const shouldCrop = translateRegionEnabled && currentVideoRegion;

    // 3. Send to translate endpoint with optional region
    const translateResponse = await fetch("/api/youtube/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: frameFilename,
        language,
        // NEW: Pass region for server-side cropping before LLM call
        region: shouldCrop ? currentVideoRegion : undefined,
      }),
    });

    // ... rest of streaming/parsing logic unchanged ...

    // 4. Save to database with FULL frame filename (not cropped)
    const saveResponse = await fetch("/api/youtube/translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId,
        videoTitle,
        timestampSeconds: timestamp,
        frameFilename,  // Always the full frame
        translationData: parsedContent.data,
      }),
    });

    // ... rest unchanged ...
  } catch (err) {
    setError(err instanceof Error ? err.message : "An error occurred");
  } finally {
    setExtracting(false);
    setTranslating(false);
  }
};
```

### Image Cropping

Since frames are stored on disk and the translate endpoint already loads them server-side, cropping should happen in the translate route. Modify `POST /api/youtube/translate` in `src/index.ts`:

```typescript
// In the translate route handler

interface TranslateRequest {
  filename: string;
  language: Language;
  region?: TranslateRegion;  // NEW: optional crop region
}

// Inside the route handler:
const { filename, language, region } = await req.json();

// Load frame from disk
const framePath = join(framesDir, filename);
let frameBuffer = await Bun.file(framePath).arrayBuffer();

// If region provided, crop before sending to LLM
if (region) {
  frameBuffer = await cropFrameBuffer(Buffer.from(frameBuffer), region);
}

// Continue with existing compression and LLM call...
```

Add cropping utility to `src/lib/video-tools.ts` (or create `src/lib/image-crop.ts`):

```typescript
import sharp from "sharp";

interface CropRegion {
  x: number;      // 0-1 normalized
  y: number;      // 0-1 normalized
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
}

export async function cropFrameBuffer(
  imageBuffer: Buffer,
  region: CropRegion
): Promise<Buffer> {
  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  // Convert normalized coordinates to pixels
  const left = Math.round(region.x * imgWidth);
  const top = Math.round(region.y * imgHeight);
  const width = Math.round(region.width * imgWidth);
  const height = Math.round(region.height * imgHeight);

  // Crop and return
  return sharp(imageBuffer)
    .extract({ left, top, width, height })
    .toBuffer();
}
```

Note: Sharp is already used in `src/lib/image-compression.ts`, so no new dependency needed.

### Region Adjustment Flow

When user clicks "Set Region" or "Adjust Region":

```typescript
// Add state for the adjustment frame
const [adjustmentFrameUrl, setAdjustmentFrameUrl] = useState<string | null>(null);

const handleAdjustRegion = async () => {
  if (!videoId || !playerRef.current) return;

  // 1. Pause the video
  playerRef.current.pauseVideo();

  // 2. Extract current frame (reuse existing extraction)
  const timestamp = playerRef.current.getCurrentTime();

  try {
    const response = await fetch("/api/youtube/extract-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, timestamp }),
    });

    if (!response.ok) throw new Error("Failed to extract frame");

    const { filename } = await response.json();

    // 3. Set frame URL and open selector
    setAdjustmentFrameUrl(`/api/youtube/frames/${filename}`);
    setIsAdjustingRegion(true);
  } catch (err) {
    setError("Failed to capture frame for region selection");
  }
};

const handleRegionConfirm = (region: TranslateRegion) => {
  if (!videoId) return;

  // Save region for this video
  setVideoRegion(videoId, region);

  // Auto-enable the toggle
  setTranslateRegionEnabled(true);

  // Close selector
  setIsAdjustingRegion(false);
  setAdjustmentFrameUrl(null);
};

const handleRegionCancel = () => {
  setIsAdjustingRegion(false);
  setAdjustmentFrameUrl(null);
};
```

Render the selector when adjusting:

```typescript
{isAdjustingRegion && adjustmentFrameUrl && (
  <RegionSelector
    frameImageUrl={adjustmentFrameUrl}
    initialRegion={videoId ? videoRegions[videoId] : undefined}
    language={language}
    onConfirm={handleRegionConfirm}
    onCancel={handleRegionCancel}
  />
)}
```

## UI Layout

### With Region Controls

The region controls integrate into the existing header controls bar:

```
+------------------------------------------------------------------+
| [X] Video Title    [Region] [Set Region] [Share] [Translate ⌘↵]  |
+------------------------------------------------------------------+
|                                                                  |
|              YouTube Video Player                                |
|         +---------------------------+                            |
|         |   [region indicator]     |  <- dashed border overlay   |
|         +---------------------------+                            |
|                                                                  |
+------------------------------------------------------------------+
|  [▶] 1:23 / 5:45                              [🔊━━━━] [⛶]      |
|  [●══]  [●═══════]   [●══]  [●═══]------------------------→     |
+------------------------------------------------------------------+
```

- **[Region]** button: Only shown when a region is set; toggles cropping on/off
- **[Set Region]** / **[Adjust Region]**: Opens the region selector modal
- **Region indicator**: Dashed border overlay on the player (only when enabled)

### Region Selector Modal

```
+------------------------------------------+
|     Select Translation Region            |
|  Draw a box around the text to translate |
+------------------------------------------+
|  +------------------------------------+  |
|  |                                    |  |
|  |  ████████████████████████████████  |  |
|  |  ████████████████████████████████  |  |
|  |  ████+------------------+████████  |  |
|  |  ████|  Selected Area   |████████  |  |
|  |  ████+------------------+████████  |  |
|  |  ████████████████████████████████  |  |
|  |                                    |  |
|  +------------------------------------+  |
+------------------------------------------+
|              [Cancel]  [Confirm]         |
+------------------------------------------+
```

The darkened area (████) represents the masked region; the clear box is the selected translation area.

## Edge Cases

### No Region Set

- Region toggle button is hidden (not rendered) until a region is set
- Button shows "Set Region" text instead of "Adjust Region"
- Clicking "Translate Frame" sends full frame (current behavior)

### Region Too Small

- Minimum region size: 5% of frame width/height
- Confirm button disabled if region is too small
- Show validation message: "Region too small"

### Video Changed

- When loading a different video, check if a region exists for that video
- If yes: load saved region, toggle state preserved
- If no: toggle disabled, no region indicator shown

### Region No Longer Valid

For edge cases where saved region might be problematic (video aspect ratio changed, etc.):
- Regions use normalized 0-1 coordinates, so they scale with video resolution
- No special handling needed

## Styling Notes

The codebase uses a **hybrid approach**: Tailwind CSS utility classes for layout/spacing/positioning, combined with **inline styles using CSS variables** for colors and theming. This pattern is consistent throughout `youtube-viewer.tsx`.

**Pattern example:**
```typescript
<button
  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-all"
  style={{
    backgroundColor: "var(--surface)",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
  }}
>
```

**CSS variables used** (defined in theme):
- `--primary`, `--primary-hover` - accent color
- `--surface` - elevated surface background
- `--border` - border color
- `--text`, `--text-muted` - text colors

**Key visual elements:**
- **Region toggle button**: Pill-style button that changes background from `var(--surface)` to `var(--primary)` when enabled
- **Region indicator on player**: Absolute positioned `div` with dashed `var(--primary)` border, low opacity background, `pointer-events-none`
- **Selector overlay**: Fixed fullscreen with `rgba(0, 0, 0, 0.8)` background
- **Selection box**: Uses `box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5)` trick to darken everything outside the selection while keeping the selected area clear

## Implementation Steps

1. **Store extension** (`src/store/youtube-store.ts`):
   - Add `TranslateRegion` type
   - Add state: `translateRegionEnabled`, `videoRegions`, `isAdjustingRegion`
   - Add actions: `setTranslateRegionEnabled`, `setVideoRegion`, `clearVideoRegion`, `setIsAdjustingRegion`
   - Update `partialize` to persist `translateRegionEnabled` and `videoRegions`

2. **Server-side cropping** (`src/lib/video-tools.ts` or new `src/lib/image-crop.ts`):
   - Add `cropFrameBuffer(buffer, region)` function using sharp

3. **Translate endpoint** (`src/index.ts`):
   - Modify `POST /api/youtube/translate` to accept optional `region` parameter
   - Crop frame buffer before compression/LLM call if region provided

4. **i18n strings** (`youtube-viewer.tsx`):
   - Add region-related strings to `translations` record

5. **Region selector component** (`src/features/youtube/region-selector.tsx`):
   - Create modal component with pointer event handling
   - Support touch and mouse interactions

6. **UI controls** (`youtube-viewer.tsx`):
   - Add region toggle button (shown when region exists)
   - Add "Set Region" / "Adjust Region" button
   - Add state for `adjustmentFrameUrl`
   - Add handlers: `handleAdjustRegion`, `handleRegionConfirm`, `handleRegionCancel`

7. **Translation flow** (`youtube-viewer.tsx`):
   - Modify `handleTranslateFrame` to pass region to translate endpoint when enabled

8. **Visual indicator** (`youtube-viewer.tsx`):
   - Add optional region overlay on the video player container

9. **Testing**:
   - Test region selection on various video aspect ratios
   - Test persistence across page reloads
   - Test toggle behavior when switching videos

## Future Enhancements

1. **Multiple regions**: Allow multiple named regions per video (e.g., "subtitles", "signs")
2. **Auto-detect text regions**: Use vision model to suggest regions with text
3. **Region presets**: Common presets like "bottom third" for typical subtitle placement
4. **Region templates**: Apply same region to multiple videos
5. **Drag handles**: Resize existing region without redrawing

## Design Decisions

1. **Normalized coordinates**: Using 0-1 values ensures regions work regardless of extraction resolution and scale correctly when the frame is displayed at different sizes.

2. **Server-side cropping**: Since frames are already stored on disk and loaded server-side for the translate endpoint, cropping happens there before compression and LLM submission. This avoids sending extra data to the client just to crop and send back.

3. **Full frame storage**: The database always stores the complete frame filename so users can see the full context when reviewing translations later. The crop is purely an optimization for the LLM call - it sees only the relevant text region.

4. **Per-video regions**: Each video can have its own region since subtitle placement varies (some videos have subs at the top, some at the bottom, some have multiple text areas). The toggle state is global (user intent to use regions) but the actual region coordinates are video-specific.

5. **Zustand persistence**: Regions are stored in the YouTube store with Zustand's `persist` middleware (same pattern as `translationBarWidth`, `playerHeight`). This keeps region settings local to the device and requires no database schema changes. The existing `partialize` function is extended to include region data.
