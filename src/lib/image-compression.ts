import type SharpType from "sharp";

export const IMAGE_COMPRESSION_THRESHOLD = 2 * 1024 * 1024; // 2MB

type Sharp = typeof SharpType;
type Metadata = SharpType.Metadata;

// Lazy-load sharp to allow native bindings extraction before import
let _sharp: Sharp | null = null;
async function getSharp(): Promise<Sharp> {
  if (!_sharp) {
    _sharp = (await import("sharp")).default;
  }
  return _sharp;
}

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface CropRegion {
  x: number;      // 0-1 normalized
  y: number;      // 0-1 normalized
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
}

/**
 * Crop an image buffer using normalized coordinates (0-1).
 * Returns a new buffer with only the cropped region.
 */
export async function cropFrameBuffer(
  imageBuffer: Buffer,
  region: CropRegion
): Promise<Buffer> {
  const sharpInstance = await getSharp();

  // Get image dimensions
  const metadata = await sharpInstance(imageBuffer).metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  // Convert normalized coordinates to pixels
  const left = Math.round(region.x * imgWidth);
  const top = Math.round(region.y * imgHeight);
  const width = Math.round(region.width * imgWidth);
  const height = Math.round(region.height * imgHeight);

  // Crop and return
  return sharpInstance(imageBuffer)
    .extract({ left, top, width, height })
    .toBuffer();
}

export interface ImageForApiResult {
  base64: string;
  mediaType: ImageMediaType;
  wasCompressed: boolean;
  originalSize: number;
  finalSize: number;
}

/**
 * Get the media type from a filename extension
 */
export function getMediaTypeFromFilename(filename: string): ImageMediaType {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/**
 * Get compressed file path for a given original path
 */
function getCompressedPath(filepath: string): string {
  return filepath.replace(/\.(\w+)$/, ".compressed.$1");
}

/**
 * Compress an image buffer to fit within the size limit.
 * Uses progressive scaling and quality reduction.
 */
async function compressImage(
  buffer: Buffer,
  mediaType: ImageMediaType,
  sizeLimit: number = IMAGE_COMPRESSION_THRESHOLD
): Promise<{ buffer: Buffer; format: ImageMediaType }> {
  const sharpInstance = await getSharp();
  const metadata = await sharpInstance(buffer).metadata();

  // Calculate initial scale factor based on size ratio
  const sizeRatio = sizeLimit / buffer.length;
  const initialScale = Math.sqrt(sizeRatio) * 0.85; // 85% of theoretical to account for encoding overhead

  // Try initial compression
  let result = await tryCompress(buffer, mediaType, metadata, initialScale, 85);
  if (result.buffer.length <= sizeLimit) {
    return result;
  }

  // Progressive compression with smaller scales and lower quality
  const scales = [0.7, 0.5, 0.4, 0.3, 0.2];
  const qualities = [80, 70, 60, 50, 40];

  for (const scale of scales) {
    for (const quality of qualities) {
      result = await tryCompress(buffer, mediaType, metadata, scale, quality);
      if (result.buffer.length <= sizeLimit) {
        return result;
      }
    }
  }

  // Last resort: very small, low quality
  return tryCompress(buffer, mediaType, metadata, 0.15, 30);
}

async function tryCompress(
  buffer: Buffer,
  mediaType: ImageMediaType,
  metadata: Metadata,
  scale: number,
  quality: number
): Promise<{ buffer: Buffer; format: ImageMediaType }> {
  const sharpInstance = await getSharp();
  let image = sharpInstance(buffer);

  // Resize if dimensions are available
  if (metadata.width && metadata.height) {
    const newWidth = Math.round(metadata.width * scale);
    image = image.resize(newWidth, null, {
      withoutEnlargement: true,
      fit: "inside",
    });
  }

  // Apply format-specific compression
  let resultBuffer: Buffer;
  let resultFormat: ImageMediaType = mediaType;

  switch (mediaType) {
    case "image/jpeg":
      resultBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer();
      break;
    case "image/png":
      // Try PNG first, fall back to JPEG if still too large
      resultBuffer = await image.png({ compressionLevel: 9 }).toBuffer();
      if (resultBuffer.length > IMAGE_COMPRESSION_THRESHOLD) {
        resultBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer();
        resultFormat = "image/jpeg";
      }
      break;
    case "image/webp":
      resultBuffer = await image.webp({ quality }).toBuffer();
      break;
    case "image/gif":
      // Convert GIF to PNG (loses animation but reduces size)
      resultBuffer = await image.png({ compressionLevel: 9 }).toBuffer();
      resultFormat = "image/png";
      if (resultBuffer.length > IMAGE_COMPRESSION_THRESHOLD) {
        resultBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer();
        resultFormat = "image/jpeg";
      }
      break;
    default:
      resultBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer();
      resultFormat = "image/jpeg";
  }

  return { buffer: resultBuffer, format: resultFormat };
}

/**
 * Main entry point: Get an image ready for the Anthropic API.
 * Checks for cached compressed version, compresses if needed, caches result.
 */
export async function getImageForApi(
  filepath: string,
  filename: string
): Promise<ImageForApiResult | null> {
  const file = Bun.file(filepath);

  if (!(await file.exists())) {
    return null;
  }

  const mediaType = getMediaTypeFromFilename(filename);
  const compressedPath = getCompressedPath(filepath);

  // Check for cached compressed version
  const compressedFile = Bun.file(compressedPath);
  if (await compressedFile.exists()) {
    const compressedBuffer = await compressedFile.arrayBuffer();
    // Determine the format of the compressed file
    const compressedMediaType = getMediaTypeFromFilename(compressedPath);
    return {
      base64: Buffer.from(compressedBuffer).toString("base64"),
      mediaType: compressedMediaType,
      wasCompressed: true,
      originalSize: 0, // Unknown since we're using cache
      finalSize: compressedBuffer.byteLength,
    };
  }

  // Read original file
  const originalBuffer = await file.arrayBuffer();
  const originalSize = originalBuffer.byteLength;

  // If under limit, return as-is
  if (originalSize <= IMAGE_COMPRESSION_THRESHOLD) {
    return {
      base64: Buffer.from(originalBuffer).toString("base64"),
      mediaType,
      wasCompressed: false,
      originalSize,
      finalSize: originalSize,
    };
  }

  // Compress the image
  const { buffer: compressedBuffer, format } = await compressImage(
    Buffer.from(originalBuffer),
    mediaType
  );

  // Cache the compressed version with correct extension
  const cachedPath = format !== mediaType
    ? compressedPath.replace(/\.\w+$/, "." + format.split("/")[1])
    : compressedPath;

  await Bun.write(cachedPath, compressedBuffer);

  return {
    base64: compressedBuffer.toString("base64"),
    mediaType: format,
    wasCompressed: true,
    originalSize,
    finalSize: compressedBuffer.length,
  };
}
