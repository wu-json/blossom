import { db } from "./database";

export interface TeacherSettingsRow {
  id: number;
  name: string;
  profile_image_path: string | null;
  personality: string | null;
  updated_at: number;
}

function ensureTeacherSettingsExist(): void {
  const existing = db
    .query<TeacherSettingsRow, []>(
      "SELECT id, name, profile_image_path, personality, updated_at FROM teacher_settings WHERE id = 1"
    )
    .get();

  if (!existing) {
    db.run(
      "INSERT INTO teacher_settings (id, name, profile_image_path, personality, updated_at) VALUES (1, 'Blossom', NULL, NULL, ?)",
      [Date.now()]
    );
  }
}

export function getTeacherSettings(): TeacherSettingsRow {
  ensureTeacherSettingsExist();
  return db
    .query<TeacherSettingsRow, []>(
      "SELECT id, name, profile_image_path, personality, updated_at FROM teacher_settings WHERE id = 1"
    )
    .get() as TeacherSettingsRow;
}

export function updateTeacherName(name: string): void {
  ensureTeacherSettingsExist();
  db.run("UPDATE teacher_settings SET name = ?, updated_at = ? WHERE id = 1", [
    name,
    Date.now(),
  ]);
}

export function updateTeacherProfileImage(imagePath: string | null): void {
  ensureTeacherSettingsExist();
  db.run(
    "UPDATE teacher_settings SET profile_image_path = ?, updated_at = ? WHERE id = 1",
    [imagePath, Date.now()]
  );
}

export function updateTeacherPersonality(personality: string | null): void {
  ensureTeacherSettingsExist();
  db.run(
    "UPDATE teacher_settings SET personality = ?, updated_at = ? WHERE id = 1",
    [personality, Date.now()]
  );
}
