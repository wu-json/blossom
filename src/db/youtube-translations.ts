import { db } from "./database";

const generateId = () => Math.random().toString(36).substring(2, 15);

export interface YouTubeTranslationRow {
  id: string;
  video_id: string;
  video_title: string | null;
  timestamp_seconds: number;
  frame_image: string | null;
  translation_data: string | null;
  created_at: number;
}

export function createYouTubeTranslation(
  videoId: string,
  videoTitle: string | null,
  timestampSeconds: number,
  frameImage: string | null,
  translationData: string | null
): YouTubeTranslationRow {
  const id = generateId();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO youtube_translations (id, video_id, video_title, timestamp_seconds, frame_image, translation_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, videoId, videoTitle, timestampSeconds, frameImage, translationData, now);

  return {
    id,
    video_id: videoId,
    video_title: videoTitle,
    timestamp_seconds: timestampSeconds,
    frame_image: frameImage,
    translation_data: translationData,
    created_at: now,
  };
}

export function getYouTubeTranslationById(id: string): YouTubeTranslationRow | null {
  const stmt = db.prepare(`
    SELECT * FROM youtube_translations WHERE id = ?
  `);

  return stmt.get(id) as YouTubeTranslationRow | null;
}

export function getYouTubeTranslationsByVideoId(videoId: string): YouTubeTranslationRow[] {
  const stmt = db.prepare(`
    SELECT * FROM youtube_translations WHERE video_id = ? ORDER BY timestamp_seconds ASC
  `);

  return stmt.all(videoId) as YouTubeTranslationRow[];
}

export function updateYouTubeTranslation(
  id: string,
  translationData: string | null,
  frameImage?: string | null
): boolean {
  let stmt;
  if (frameImage !== undefined) {
    stmt = db.prepare(`
      UPDATE youtube_translations SET translation_data = ?, frame_image = ? WHERE id = ?
    `);
    const result = stmt.run(translationData, frameImage, id);
    return result.changes > 0;
  } else {
    stmt = db.prepare(`
      UPDATE youtube_translations SET translation_data = ? WHERE id = ?
    `);
    const result = stmt.run(translationData, id);
    return result.changes > 0;
  }
}

export function updateYouTubeTranslationTimestamp(
  id: string,
  timestampSeconds: number
): boolean {
  const stmt = db.prepare(`
    UPDATE youtube_translations SET timestamp_seconds = ? WHERE id = ?
  `);
  const result = stmt.run(timestampSeconds, id);
  return result.changes > 0;
}

export function deleteYouTubeTranslation(id: string): boolean {
  const stmt = db.prepare(`DELETE FROM youtube_translations WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes > 0;
}
