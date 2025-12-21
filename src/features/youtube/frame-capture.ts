export interface CaptureResult {
  imageBlob: Blob;
  timestamp: number;
}

export interface PlayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Capture session manager - keeps stream open for multiple frame grabs
 */
export class CaptureSession {
  private stream: MediaStream | null = null;
  private imageCapture: ImageCapture | null = null;
  private onEndedCallback: (() => void) | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "window",
      } as MediaTrackConstraints,
      audio: false,
    });

    const track = this.stream.getVideoTracks()[0];
    if (!track) {
      throw new Error("No video track available");
    }

    // ImageCapture may not be available in all browsers, but we check support separately
    this.imageCapture = new (window as unknown as { ImageCapture: new (track: MediaStreamTrack) => ImageCapture }).ImageCapture(track);

    // Listen for user clicking "Stop Sharing" in browser UI
    track.onended = () => {
      this.stream = null;
      this.imageCapture = null;
      this.onEndedCallback?.();
    };
  }

  onEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }

  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }

  async grabFrame(
    currentTimestamp: number,
    playerBounds: PlayerBounds
  ): Promise<CaptureResult> {
    if (!this.imageCapture) {
      throw new Error("Capture session not active");
    }

    const bitmap = await (this.imageCapture as unknown as { grabFrame: () => Promise<ImageBitmap> }).grabFrame();

    // Create canvas and crop to player region
    const canvas = document.createElement("canvas");
    canvas.width = playerBounds.width;
    canvas.height = playerBounds.height;
    const ctx = canvas.getContext("2d")!;

    // Calculate scale factor (screen capture may be at different resolution)
    const scaleX = bitmap.width / window.innerWidth;
    const scaleY = bitmap.height / window.innerHeight;

    // Draw only the player region
    ctx.drawImage(
      bitmap,
      playerBounds.x * scaleX, // source x
      playerBounds.y * scaleY, // source y
      playerBounds.width * scaleX, // source width
      playerBounds.height * scaleY, // source height
      0, // dest x
      0, // dest y
      playerBounds.width, // dest width
      playerBounds.height // dest height
    );

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });

    return {
      imageBlob: blob,
      timestamp: currentTimestamp,
    };
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.imageCapture = null;
    }
  }
}

/**
 * Get player element bounds before capture
 */
export function getPlayerBounds(playerElement: HTMLElement): PlayerBounds {
  const rect = playerElement.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Check if Screen Capture API is supported
 */
export function isScreenCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "mediaDevices" in navigator &&
    "getDisplayMedia" in navigator.mediaDevices
  );
}

/**
 * Convert Blob to base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64Data = base64.split(",")[1] || "";
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
