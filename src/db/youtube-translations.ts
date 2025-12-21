import { db } from "./database";

export interface YouTubeTranslationRow {
  id: string;
  video_id: string;
  video_title: string | null;
  timestamp_seconds: number;
  frame_image: string | null;
  translation_data: string;
  created_at: number;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function createYouTubeTranslation(
  videoId: string,
  videoTitle: string | null,
  timestampSeconds: number,
  frameImage: string | null,
  translationData: string
): YouTubeTranslationRow {
  const id = generateId();
  const createdAt = Date.now();

  db.run(
    `INSERT INTO youtube_translations (id, video_id, video_title, timestamp_seconds, frame_image, translation_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, videoId, videoTitle, timestampSeconds, frameImage, translationData, createdAt]
  );

  return {
    id,
    video_id: videoId,
    video_title: videoTitle,
    timestamp_seconds: timestampSeconds,
    frame_image: frameImage,
    translation_data: translationData,
    created_at: createdAt,
  };
}

export function getYouTubeTranslationById(id: string): YouTubeTranslationRow | null {
  return db.query<YouTubeTranslationRow, [string]>(
    "SELECT * FROM youtube_translations WHERE id = ?"
  ).get(id) as YouTubeTranslationRow | null;
}

export function getYouTubeTranslationsByVideoId(videoId: string): YouTubeTranslationRow[] {
  return db.query<YouTubeTranslationRow, [string]>(
    "SELECT * FROM youtube_translations WHERE video_id = ? ORDER BY created_at DESC"
  ).all(videoId) as YouTubeTranslationRow[];
}

export function deleteYouTubeTranslation(id: string): void {
  db.run("DELETE FROM youtube_translations WHERE id = ?", [id]);
}

export function updateYouTubeTranslationData(id: string, translationData: string): void {
  db.run(
    "UPDATE youtube_translations SET translation_data = ? WHERE id = ?",
    [translationData, id]
  );
}
