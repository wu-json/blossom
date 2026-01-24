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

Extend the YouTube store to track region settings per video:

```typescript
// src/store/youtube-store.ts

interface TranslateRegion {
  x: number;      // Left offset (0-1, percentage of frame width)
  y: number;      // Top offset (0-1, percentage of frame height)
  width: number;  // Region width (0-1, percentage)
  height: number; // Region height (0-1, percentage)
}

interface VideoRegionSettings {
  [videoId: string]: TranslateRegion;
}

interface YouTubeState {
  // ... existing state ...

  translateRegionEnabled: boolean;
  videoRegions: VideoRegionSettings;
  isAdjustingRegion: boolean;

  setTranslateRegionEnabled: (enabled: boolean) => void;
  setVideoRegion: (videoId: string, region: TranslateRegion) => void;
  clearVideoRegion: (videoId: string) => void;
  setIsAdjustingRegion: (isAdjusting: boolean) => void;
}
```

Using normalized coordinates (0-1) ensures the region scales correctly regardless of the actual frame resolution returned by ffmpeg.

### Persistence

Region settings are persisted to localStorage via Zustand's persist middleware (existing pattern). The `videoRegions` map uses video IDs as keys, so each video can have its own region.

### UI Components

#### Control Bar

Add toggle and adjust button near the "Translate Frame" button:

```
+------------------------------------------+
|  [Translate Region: ON/OFF]  [Adjust]    |
|            [ Translate Frame ]           |
+------------------------------------------+
```

```typescript
// In youtube-viewer.tsx controls section

<div className="translate-controls">
  <div className="region-toggle">
    <Switch
      checked={translateRegionEnabled}
      onCheckedChange={setTranslateRegionEnabled}
      disabled={!currentVideoRegion} // Disabled if no region set
    />
    <label>Translate Region</label>
  </div>

  <Button
    variant="outline"
    size="sm"
    onClick={() => setIsAdjustingRegion(true)}
  >
    <Crop className="w-4 h-4 mr-2" />
    {currentVideoRegion ? "Adjust Region" : "Set Region"}
  </Button>
</div>

<Button onClick={handleTranslateFrame}>
  <Languages className="w-4 h-4 mr-2" />
  Translate Frame
</Button>
```

#### Region Selection Overlay

A modal overlay that displays the current frame and allows drawing a bounding box:

```typescript
// src/features/youtube/region-selector.tsx

interface RegionSelectorProps {
  frameImageBase64: string;
  initialRegion?: TranslateRegion;
  onConfirm: (region: TranslateRegion) => void;
  onCancel: () => void;
}

function RegionSelector({
  frameImageBase64,
  initialRegion,
  onConfirm,
  onCancel
}: RegionSelectorProps) {
  const [region, setRegion] = useState<TranslateRegion | null>(initialRegion ?? null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setRegion(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;

    // Calculate region from start to current (handle negative drag)
    setRegion({
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y),
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setStartPoint(null);
  };

  return (
    <div className="region-selector-overlay">
      <div className="region-selector-modal">
        <div className="region-selector-header">
          <h3>Select Translation Region</h3>
          <p>Draw a box around the text you want to translate</p>
        </div>

        <div
          ref={containerRef}
          className="region-selector-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img src={`data:image/png;base64,${frameImageBase64}`} alt="Video frame" />

          {/* Darkened overlay outside selection */}
          {region && (
            <div className="region-mask">
              <div
                className="region-selection"
                style={{
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${region.width * 100}%`,
                  height: `${region.height * 100}%`,
                }}
              />
            </div>
          )}
        </div>

        <div className="region-selector-actions">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => region && onConfirm(region)}
            disabled={!region || region.width < 0.05 || region.height < 0.05}
          >
            Confirm
          </Button>
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

Modify the translation flow to handle region cropping:

```typescript
// In youtube-viewer.tsx

async function handleTranslateFrame() {
  const timestamp = playerRef.current?.getCurrentTime() ?? 0;

  // 1. Extract full frame from video
  const { imageBase64: fullFrameBase64 } = await extractFrame(videoId, timestamp);

  // 2. Determine what to send to LLM
  let llmImageBase64 = fullFrameBase64;

  if (translateRegionEnabled && currentVideoRegion) {
    // Crop the image to the selected region
    llmImageBase64 = await cropImage(fullFrameBase64, currentVideoRegion);
  }

  // 3. Send cropped (or full) image to LLM for translation
  const translation = await translateImage(llmImageBase64, language);

  // 4. Save to database with FULL frame (not cropped)
  await saveYouTubeTranslation({
    videoId,
    videoTitle,
    timestampSeconds: timestamp,
    frameImage: fullFrameBase64, // Always save full frame
    translationData: translation,
  });

  // 5. Display translation
  setCurrentTranslation(translation);
}
```

### Image Cropping

Server-side cropping using sharp (already a dependency for image compression):

```typescript
// POST /api/youtube/crop-image

interface CropImageRequest {
  imageBase64: string;
  region: TranslateRegion;
}

interface CropImageResponse {
  croppedImageBase64: string;
}
```

```typescript
// src/lib/image-crop.ts

import sharp from "sharp";

interface CropRegion {
  x: number;      // 0-1
  y: number;      // 0-1
  width: number;  // 0-1
  height: number; // 0-1
}

async function cropImage(imageBase64: string, region: CropRegion): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");

  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  // Convert normalized coordinates to pixels
  const left = Math.round(region.x * imgWidth);
  const top = Math.round(region.y * imgHeight);
  const width = Math.round(region.width * imgWidth);
  const height = Math.round(region.height * imgHeight);

  // Crop the image
  const croppedBuffer = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .toBuffer();

  return croppedBuffer.toString("base64");
}
```

Alternatively, perform cropping client-side using Canvas API to avoid an extra server round-trip:

```typescript
// src/lib/crop-image-client.ts

async function cropImageClient(
  imageBase64: string,
  region: TranslateRegion
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Calculate pixel coordinates
      const sx = region.x * img.width;
      const sy = region.y * img.height;
      const sw = region.width * img.width;
      const sh = region.height * img.height;

      canvas.width = sw;
      canvas.height = sh;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // Return as base64 (remove data URL prefix)
      const dataUrl = canvas.toDataURL("image/png");
      resolve(dataUrl.replace(/^data:image\/png;base64,/, ""));
    };
    img.onerror = reject;
    img.src = `data:image/png;base64,${imageBase64}`;
  });
}
```

**Recommendation**: Use client-side cropping to reduce latency and server load. The cropped image only needs to go to the LLM anyway.

### Region Adjustment Flow

When user clicks "Adjust Region":

```typescript
async function handleAdjustRegion() {
  // 1. Pause the video
  playerRef.current?.pauseVideo();

  // 2. Capture current frame for display
  const timestamp = playerRef.current?.getCurrentTime() ?? 0;
  const { imageBase64 } = await extractFrame(videoId, timestamp);

  // 3. Store frame and open selector
  setAdjustmentFrame(imageBase64);
  setIsAdjustingRegion(true);
}

function handleRegionConfirm(region: TranslateRegion) {
  // Save region for this video
  setVideoRegion(videoId, region);

  // Auto-enable the toggle
  setTranslateRegionEnabled(true);

  // Close selector
  setIsAdjustingRegion(false);
  setAdjustmentFrame(null);
}
```

## UI Layout

### With Region Controls

```
+------------------------------------------+
|  [YouTube URL input field]    [Load]     |
+------------------------------------------+
|                                          |
|         YouTube Video Player             |
|    +---------------------------+         |
|    |   [region indicator]     |         |
|    +---------------------------+         |
|                                          |
+------------------------------------------+
| [●══]  [●═══════]   [●══]  [●═══]-----→ |
| 0:00                              12:34  |
+------------------------------------------+
| [Translate Region: ON] [Adjust Region]   |
|          [ Translate Frame ]             |
+------------------------------------------+
|                                          |
|         Translation Card                 |
|                                          |
+------------------------------------------+
```

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

- Toggle is disabled (grayed out) until a region is set
- "Set Region" button text instead of "Adjust Region"
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

All styling uses Tailwind CSS classes (project standard). Key visual elements:

- **Controls bar**: Flexbox row with gap, border-bottom separator
- **Region indicator on video**: Absolute positioned, dashed border, low-opacity accent background, `pointer-events-none`
- **Selector overlay**: Fixed fullscreen with `bg-black/80`, centered flex container
- **Selector modal**: Rounded card with max-width/height constraints, overflow hidden
- **Selection box**: Uses `box-shadow: 0 0 0 9999px` trick to darken everything outside the selection (may need a small custom utility or inline style for this effect)

## Implementation Steps

1. **Store extension**: Add region state to `youtube-store.ts`
2. **UI controls**: Add toggle and adjust button to viewer
3. **Region selector**: Create `RegionSelector` component
4. **Client-side cropping**: Implement `cropImageClient()` utility
5. **Translation flow**: Modify `handleTranslateFrame()` to crop when enabled
6. **Visual indicator**: Add region overlay on video player
7. **Persistence**: Ensure Zustand persists region settings
8. **Edge cases**: Handle no-region and too-small validation
9. **Styling**: Apply CSS for all new components

## Future Enhancements

1. **Multiple regions**: Allow multiple named regions per video (e.g., "subtitles", "signs")
2. **Auto-detect text regions**: Use vision model to suggest regions with text
3. **Region presets**: Common presets like "bottom third" for typical subtitle placement
4. **Region templates**: Apply same region to multiple videos
5. **Drag handles**: Resize existing region without redrawing

## Design Decisions

1. **Normalized coordinates**: Using 0-1 values ensures regions work regardless of extraction resolution and scale with the display.

2. **Client-side cropping**: Reduces server round-trips since the cropped image is only needed for the LLM call, not storage.

3. **Full frame storage**: The database always stores the complete frame so users can see the full context when reviewing translations later. The crop is purely an LLM optimization.

4. **Per-video regions**: Each video can have its own region since subtitle placement varies. The toggle state is global (user intent to use regions) but the actual region is video-specific.

5. **LocalStorage persistence**: Regions are stored in Zustand with localStorage persistence, not in the database. This keeps them local to the device and avoids schema changes. If a user wants to sync regions across devices, this could be revisited.
