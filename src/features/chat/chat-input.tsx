import { useState, useRef, type FormEvent, type KeyboardEvent, type DragEvent, type ClipboardEvent } from "react";
import { ArrowUp, Paperclip, X, ImageIcon } from "lucide-react";
import { useChatStore } from "../../store/chat-store";
import type { Language } from "../../types/chat";

const placeholders: Record<Language, string> = {
  ja: "何でも聞いてね...",
  zh: "想聊点什么？",
  ko: "무엇이든 물어보세요...",
};

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

export function ChatInput() {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const isTyping = useChatStore((state) => state.isTyping);
  const apiKeyConfigured = useChatStore((state) => state.apiKeyConfigured);
  const language = useChatStore((state) => state.language);

  const handleFileSelect = (files: FileList | File[] | null) => {
    if (!files) return;

    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    const maxSize = 20 * 1024 * 1024; // 20MB
    const newImages: PendingImage[] = [];

    Array.from(files).forEach((file) => {
      if (
        validTypes.includes(file.type) &&
        file.size <= maxSize &&
        pendingImages.length + newImages.length < 5
      ) {
        newImages.push({
          id: Math.random().toString(36).substring(2),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    });

    setPendingImages((prev) => [...prev, ...newImages]);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFileSelect(imageFiles);
    }
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || isTyping || apiKeyConfigured === false || isUploading) return;

    setIsUploading(true);

    // Upload images first
    const uploadedUrls: string[] = [];
    for (const img of pendingImages) {
      const formData = new FormData();
      formData.append("image", img.file);

      try {
        const response = await fetch("/api/chat/images", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (data.url) uploadedUrls.push(data.url);
      } catch (error) {
        console.error("Failed to upload image:", error);
      }

      URL.revokeObjectURL(img.previewUrl);
    }

    setIsUploading(false);

    // Send message with images
    sendMessage(trimmed, uploadedUrls.length > 0 ? uploadedUrls : undefined);

    // Scroll to show the loading indicator after a short delay
    setTimeout(() => {
      const messageList = document.querySelector("[data-message-list]");
      if (messageList) {
        messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
      }
    }, 250);

    setInput("");
    setPendingImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const hasInput = input.trim().length > 0 || pendingImages.length > 0;
  const canSend = hasInput && !isTyping && apiKeyConfigured !== false && !isUploading;

  return (
    <div className="p-4 pb-6">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div
          className="relative rounded-2xl transition-shadow duration-200"
          style={{
            backgroundColor: "var(--input-bg)",
            boxShadow: isDragging
              ? "0 0 0 2px var(--primary)"
              : isFocused
              ? "0 0 0 1px var(--border), 0 4px 16px rgba(0, 0, 0, 0.12)"
              : "0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--border)",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Image Previews */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 p-3 pb-0 flex-wrap">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.previewUrl}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg border"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: "var(--text)", color: "var(--background)" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Row */}
          <div className="flex items-end">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center ml-2 mb-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
              title="Attach images"
            >
              <Paperclip className="w-[18px] h-[18px]" />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileSelect(e.target.files)}
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onPaste={handlePaste}
              placeholder={placeholders[language]}
              rows={1}
              className="flex-1 resize-none bg-transparent pr-14 py-3.5 text-[14px] focus-visible:outline-none min-h-[52px] max-h-[160px] placeholder:text-[var(--text-muted)]"
              style={{
                color: "var(--text)",
                height: "auto",
                overflow: "hidden",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
              }}
            />

            <button
              type="submit"
              disabled={!canSend}
              className="absolute right-2 bottom-2 h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 disabled:hover:scale-100"
              style={{
                backgroundColor: canSend ? "var(--primary)" : "var(--border)",
                color: canSend ? "white" : "var(--text-muted)",
                opacity: canSend ? 1 : 0.6,
              }}
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
              )}
            </button>
          </div>

          {/* Drag Overlay */}
          {isDragging && (
            <div
              className="absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none"
              style={{ backgroundColor: "var(--primary)", opacity: 0.1 }}
            >
              <div className="flex items-center gap-2 pointer-events-none" style={{ color: "var(--primary)" }}>
                <ImageIcon className="w-6 h-6" />
                <span className="text-sm font-medium">Drop images here</span>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
