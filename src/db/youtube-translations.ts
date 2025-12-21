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

export interface RecentlyTranslatedVideo {
  video_id: string;
  video_title: string | null;
  translation_count: number;
  latest_frame_image: string | null;
  latest_timestamp_seconds: number;
  latest_created_at: number;
}

export function getRecentlyTranslatedVideos(
  limit: number,
  offset: number
): RecentlyTranslatedVideo[] {
  const stmt = db.prepare(`
    SELECT
      video_id,
      video_title,
      COUNT(*) as translation_count,
      (
        SELECT frame_image
        FROM youtube_translations t2
        WHERE t2.video_id = youtube_translations.video_id
          AND t2.frame_image IS NOT NULL
        ORDER BY t2.created_at DESC
        LIMIT 1
      ) as latest_frame_image,
      (
        SELECT timestamp_seconds
        FROM youtube_translations t3
        WHERE t3.video_id = youtube_translations.video_id
        ORDER BY t3.created_at DESC
        LIMIT 1
      ) as latest_timestamp_seconds,
      MAX(created_at) as latest_created_at
    FROM youtube_translations
    WHERE translation_data IS NOT NULL
    GROUP BY video_id
    ORDER BY latest_created_at DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(limit, offset) as RecentlyTranslatedVideo[];
}

export function getRecentlyTranslatedVideosCount(): number {
  const stmt = db.prepare(`
    SELECT COUNT(DISTINCT video_id) as count
    FROM youtube_translations
    WHERE translation_data IS NOT NULL
  `);

  const result = stmt.get() as { count: number };
  return result.count;
}
