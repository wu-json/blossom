import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { MenuIcon } from "../../components/icons/menu-icon";
import { useChatStore } from "../../store/chat-store";
import { version } from "../../version";
import { User, Upload, Trash2, X, Check } from "lucide-react";
import type { Language } from "../../types/chat";

const translations: Record<Language, {
  profilePicture: string;
  uploadPhoto: string;
  removePhoto: string;
  teacherName: string;
  personality: string;
  personalityPlaceholder: string;
  save: string;
  saving: string;
  saved: string;
  cropImage: string;
  cancel: string;
  apply: string;
}> = {
  ja: {
    profilePicture: "プロフィール画像",
    uploadPhoto: "写真をアップロード",
    removePhoto: "削除",
    teacherName: "先生の名前",
    personality: "性格・スタイル",
    personalityPlaceholder: "先生の性格やスタイルを説明してください（例：厳格で規律を重視する、ユーモアがある、など）",
    save: "保存",
    saving: "保存中...",
    saved: "保存しました",
    cropImage: "画像を切り抜き",
    cancel: "キャンセル",
    apply: "適用",
  },
  zh: {
    profilePicture: "头像",
    uploadPhoto: "上传照片",
    removePhoto: "删除",
    teacherName: "老师的名字",
    personality: "性格和风格",
    personalityPlaceholder: "描述老师的性格和教学风格（例如：严格且注重纪律、幽默风趣等）",
    save: "保存",
    saving: "保存中...",
    saved: "已保存",
    cropImage: "裁剪图片",
    cancel: "取消",
    apply: "应用",
  },
  ko: {
    profilePicture: "프로필 사진",
    uploadPhoto: "사진 업로드",
    removePhoto: "삭제",
    teacherName: "선생님 이름",
    personality: "성격 및 스타일",
    personalityPlaceholder: "선생님의 성격과 스타일을 설명해 주세요 (예: 엄격하고 규율을 중시함, 유머가 있음 등)",
    save: "저장",
    saving: "저장 중...",
    saved: "저장됨",
    cropImage: "이미지 자르기",
    cancel: "취소",
    apply: "적용",
  },
};

// Helper function to create cropped image blob
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Set canvas size to the cropped area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      "image/png",
      1
    );
  });
}

export function TeacherPage() {
  const {
    toggleSidebar,
    sidebarCollapsed,
    language,
    teacherSettings,
    updateTeacherName,
    updateTeacherPersonality,
    uploadTeacherImage,
    removeTeacherImage,
  } = useChatStore();

  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(teacherSettings?.name || "Blossom");
  const [personality, setPersonality] = useState(teacherSettings?.personality || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [personalitySaveStatus, setPersonalitySaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    if (teacherSettings?.name) {
      setName(teacherSettings.name);
    }
  }, [teacherSettings?.name]);

  useEffect(() => {
    if (teacherSettings?.personality !== undefined) {
      setPersonality(teacherSettings.personality || "");
    }
  }, [teacherSettings?.personality]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaveStatus("saving");
    await updateTeacherName(name.trim());
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handlePersonalitySave = async () => {
    setPersonalitySaveStatus("saving");
    await updateTeacherPersonality(personality.trim());
    setPersonalitySaveStatus("saved");
    setTimeout(() => setPersonalitySaveStatus("idle"), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setCropperOpen(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropCancel = () => {
    setCropperOpen(false);
    setImageSrc(null);
  };

  const handleCropApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const file = new File([croppedBlob], "profile.png", { type: "image/png" });
      await uploadTeacherImage(file);
      setCropperOpen(false);
      setImageSrc(null);
    } catch (error) {
      console.error("Failed to crop image:", error);
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
        <div className="space-y-6">
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
                    src={`${teacherSettings.profileImagePath}?t=${Date.now()}`}
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

          {/* Personality Section */}
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
              {t.personality}
            </h2>
            <div className="flex flex-col gap-3">
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder={t.personalityPlaceholder}
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors resize-none"
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
              <div className="flex justify-end">
                <button
                  onClick={handlePersonalitySave}
                  disabled={personalitySaveStatus === "saving"}
                  className="px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: personalitySaveStatus === "saved" ? "var(--success, #22c55e)" : "var(--primary)",
                    color: "white",
                  }}
                >
                  {personalitySaveStatus === "saving" ? t.saving : personalitySaveStatus === "saved" ? t.saved : t.save}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Image Cropper Modal */}
      {cropperOpen && imageSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
        >
          <div
            className="w-full max-w-lg mx-4 rounded-xl overflow-hidden"
            style={{ backgroundColor: "var(--surface)" }}
          >
            {/* Modal Header */}
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "var(--border)" }}
            >
              <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {t.cropImage}
              </h3>
              <button
                onClick={handleCropCancel}
                className="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={18} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Cropper Area */}
            <div className="relative h-80" style={{ backgroundColor: "#000" }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            {/* Zoom Slider */}
            <div className="px-4 py-3">
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "var(--primary)" }}
              />
            </div>

            {/* Modal Footer */}
            <div
              className="px-4 py-3 border-t flex justify-end gap-2"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={handleCropCancel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={14} />
                {t.cancel}
              </button>
              <button
                onClick={handleCropApply}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "white",
                }}
              >
                <Check size={14} />
                {t.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
