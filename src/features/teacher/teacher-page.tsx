import * as React from "react";
import { useRef, useState, useEffect } from "react";
import { MenuIcon } from "../../components/icons/menu-icon";
import { useChatStore } from "../../store/chat-store";
import { version } from "../../version";
import { User, Upload, Trash2 } from "lucide-react";
import type { Language } from "../../types/chat";

const translations: Record<Language, {
  profilePicture: string;
  uploadPhoto: string;
  removePhoto: string;
  teacherName: string;
  save: string;
  saving: string;
  saved: string;
}> = {
  ja: {
    profilePicture: "プロフィール画像",
    uploadPhoto: "写真をアップロード",
    removePhoto: "削除",
    teacherName: "先生の名前",
    save: "保存",
    saving: "保存中...",
    saved: "保存しました",
  },
  zh: {
    profilePicture: "头像",
    uploadPhoto: "上传照片",
    removePhoto: "删除",
    teacherName: "老师的名字",
    save: "保存",
    saving: "保存中...",
    saved: "已保存",
  },
  ko: {
    profilePicture: "프로필 사진",
    uploadPhoto: "사진 업로드",
    removePhoto: "삭제",
    teacherName: "선생님 이름",
    save: "저장",
    saving: "저장 중...",
    saved: "저장됨",
  },
};

export function TeacherPage() {
  const {
    toggleSidebar,
    sidebarCollapsed,
    language,
    teacherSettings,
    updateTeacherName,
    uploadTeacherImage,
    removeTeacherImage,
  } = useChatStore();

  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(teacherSettings?.name || "Blossom");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (teacherSettings?.name) {
      setName(teacherSettings.name);
    }
  }, [teacherSettings?.name]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaveStatus("saving");
    await updateTeacherName(name.trim());
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadTeacherImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async () => {
    await removeTeacherImage();
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--background)" }}
    >
      <header
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-2 p-1.5 -ml-1.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Toggle sidebar"
        >
          <MenuIcon isOpen={sidebarCollapsed} />
          <h1 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            blossom
          </h1>
          <span className="text-xs self-end mb-[2px]" style={{ color: "var(--text-muted)" }}>
            v{version}
          </span>
        </button>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Profile Picture Section */}
          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-4"
              style={{ color: "var(--text)" }}
            >
              {t.profilePicture}
            </h2>
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  backgroundColor: "var(--border)",
                }}
              >
                {teacherSettings?.profileImagePath ? (
                  <img
                    src={teacherSettings.profileImagePath}
                    alt="Teacher"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={32} style={{ color: "var(--text-muted)" }} />
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "white",
                  }}
                >
                  <Upload size={14} />
                  {t.uploadPhoto}
                </button>
                {teacherSettings?.profileImagePath && (
                  <button
                    onClick={handleRemoveImage}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{
                      color: "var(--text-muted)",
                    }}
                  >
                    <Trash2 size={14} />
                    {t.removePhoto}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Teacher Name Section */}
          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-4"
              style={{ color: "var(--text)" }}
            >
              {t.teacherName}
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border)";
                }}
              />
              <button
                onClick={handleSave}
                disabled={saveStatus === "saving" || !name.trim()}
                className="px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: saveStatus === "saved" ? "var(--success, #22c55e)" : "var(--primary)",
                  color: "white",
                }}
              >
                {saveStatus === "saving" ? t.saving : saveStatus === "saved" ? t.saved : t.save}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
