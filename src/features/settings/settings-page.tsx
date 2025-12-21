import * as React from "react";
import { useState, useRef } from "react";
import { MenuIcon } from "../../components/icons/menu-icon";
import { HeaderControls } from "../../components/ui/header-controls";
import { useChatStore } from "../../store/chat-store";
import { version } from "../../generated/version";
import type { Language } from "../../types/chat";

const translations: Record<Language, {
  dataStorage: string;
  dataStorageDesc: string;
  dataDirectory: string;
  aiProvider: string;
  aiProviderDesc: string;
  anthropicApiKey: string;
  notConfigured: string;
  exportData: string;
  exportDataDesc: string;
  exporting: string;
  importData: string;
  importDataDesc: string;
  importing: string;
  dangerZone: string;
  dangerZoneDesc: string;
  deleteAllData: string;
  deleteConfirmDesc: string;
  deleteItem1: string;
  deleteItem2: string;
  deleteItem3: string;
  typeDeleteToConfirm: string;
  cancel: string;
  deleting: string;
  deleteEverything: string;
  importConfirmDesc: string;
  file: string;
  import: string;
}> = {
  ja: {
    dataStorage: "データ保存",
    dataStorageDesc: "Blossomがデータを保存するディレクトリ。BLOSSOM_DIR環境変数で設定できます。",
    dataDirectory: "データディレクトリ:",
    aiProvider: "AIプロバイダー",
    aiProviderDesc: "ClaudeのAPIキー。ANTHROPIC_API_KEY環境変数で設定できます。",
    anthropicApiKey: "Anthropic APIキー:",
    notConfigured: "未設定",
    exportData: "データをエクスポート",
    exportDataDesc: "他のデバイスに転送するためにすべてのデータをバックアップファイルとしてダウンロードします。",
    exporting: "エクスポート中...",
    importData: "データをインポート",
    importDataDesc: "バックアップファイルからデータを復元します。",
    importing: "インポート中...",
    dangerZone: "危険ゾーン",
    dangerZoneDesc: "会話、メッセージ、先生の設定、アップロードされたファイルを含むすべてのBlossomデータを完全に削除します。",
    deleteAllData: "すべてのデータを削除",
    deleteConfirmDesc: "この操作は取り消せません。以下が完全に削除されます:",
    deleteItem1: "すべての会話とメッセージ",
    deleteItem2: "先生の設定とプロフィール画像",
    deleteItem3: "アップロードされたすべてのファイル",
    typeDeleteToConfirm: "確認のため delete と入力してください:",
    cancel: "キャンセル",
    deleting: "削除中...",
    deleteEverything: "すべて削除",
    importConfirmDesc: "バックアップファイルの内容で既存のデータをすべて置き換えます。この操作は取り消せません。",
    file: "ファイル:",
    import: "インポート",
  },
  zh: {
    dataStorage: "数据存储",
    dataStorageDesc: "Blossom存储数据的目录。可通过BLOSSOM_DIR环境变量配置。",
    dataDirectory: "数据目录:",
    aiProvider: "AI提供商",
    aiProviderDesc: "Claude的API密钥。可通过ANTHROPIC_API_KEY环境变量配置。",
    anthropicApiKey: "Anthropic API密钥:",
    notConfigured: "未配置",
    exportData: "导出数据",
    exportDataDesc: "下载所有数据作为备份文件，以便传输到其他设备。",
    exporting: "导出中...",
    importData: "导入数据",
    importDataDesc: "从备份文件恢复数据。",
    importing: "导入中...",
    dangerZone: "危险区域",
    dangerZoneDesc: "永久删除所有Blossom数据，包括对话、消息、老师设置和上传的文件。",
    deleteAllData: "删除所有数据",
    deleteConfirmDesc: "此操作无法撤消。以下内容将被永久删除:",
    deleteItem1: "所有对话和消息",
    deleteItem2: "老师设置和头像",
    deleteItem3: "所有上传的文件",
    typeDeleteToConfirm: "输入 delete 确认:",
    cancel: "取消",
    deleting: "删除中...",
    deleteEverything: "删除全部",
    importConfirmDesc: "这将用备份文件的内容替换所有现有数据。此操作无法撤消。",
    file: "文件:",
    import: "导入",
  },
  ko: {
    dataStorage: "데이터 저장",
    dataStorageDesc: "Blossom이 데이터를 저장하는 디렉토리입니다. BLOSSOM_DIR 환경 변수로 설정할 수 있습니다.",
    dataDirectory: "데이터 디렉토리:",
    aiProvider: "AI 제공자",
    aiProviderDesc: "Claude API 키입니다. ANTHROPIC_API_KEY 환경 변수로 설정할 수 있습니다.",
    anthropicApiKey: "Anthropic API 키:",
    notConfigured: "설정되지 않음",
    exportData: "데이터 내보내기",
    exportDataDesc: "다른 기기로 전송하기 위해 모든 데이터를 백업 파일로 다운로드합니다.",
    exporting: "내보내는 중...",
    importData: "데이터 가져오기",
    importDataDesc: "백업 파일에서 데이터를 복원합니다.",
    importing: "가져오는 중...",
    dangerZone: "위험 구역",
    dangerZoneDesc: "대화, 메시지, 선생님 설정, 업로드된 파일을 포함한 모든 Blossom 데이터를 영구적으로 삭제합니다.",
    deleteAllData: "모든 데이터 삭제",
    deleteConfirmDesc: "이 작업은 취소할 수 없습니다. 다음 항목이 영구적으로 삭제됩니다:",
    deleteItem1: "모든 대화 및 메시지",
    deleteItem2: "선생님 설정 및 프로필 이미지",
    deleteItem3: "업로드된 모든 파일",
    typeDeleteToConfirm: "확인하려면 delete를 입력하세요:",
    cancel: "취소",
    deleting: "삭제 중...",
    deleteEverything: "모두 삭제",
    importConfirmDesc: "백업 파일의 내용으로 기존 데이터를 모두 대체합니다. 이 작업은 취소할 수 없습니다.",
    file: "파일:",
    import: "가져오기",
  },
};

export function SettingsPage() {
  const { toggleSidebar, sidebarCollapsed, deleteAllData, exportData, importData, dataDir, apiKeyPreview, language } = useChatStore();
  const t = translations[language];
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteAllData = async () => {
    if (deleteInput !== "delete") return;
    setIsDeleting(true);
    await deleteAllData();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportData();
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowImportModal(true);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      await importData(selectedFile);
    } finally {
      setIsImporting(false);
      setShowImportModal(false);
      setSelectedFile(null);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--background)" }}
    >
      <header
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
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

        <HeaderControls />
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              {t.dataStorage}
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              {t.dataStorageDesc}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t.dataDirectory}
              </span>
              <code
                className="px-2 py-1 rounded text-sm font-mono"
                style={{
                  backgroundColor: "var(--background)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                {dataDir || "~/.blossom"}
              </code>
            </div>
          </section>

          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              {t.aiProvider}
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              {t.aiProviderDesc}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t.anthropicApiKey}
              </span>
              <code
                className="px-2 py-1 rounded text-sm font-mono"
                style={{
                  backgroundColor: "var(--background)",
                  color: apiKeyPreview ? "var(--text)" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {apiKeyPreview || t.notConfigured}
              </code>
            </div>
          </section>

          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              {t.exportData}
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              {t.exportDataDesc}
            </p>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              {isExporting ? t.exporting : t.exportData}
            </button>
          </section>

          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              {t.importData}
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              {t.importDataDesc}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              {isImporting ? t.importing : t.importData}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
            />
          </section>

          <section
            className="p-4 rounded-lg border border-red-300 dark:border-red-800"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <h2 className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">
              {t.dangerZone}
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              {t.dangerZoneDesc}
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              {t.deleteAllData}
            </button>
          </section>
        </div>
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteInput("");
            }}
          />
          <div
            className="relative z-10 w-full max-w-md p-6 rounded-xl border shadow-xl"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--text)" }}
            >
              {t.deleteAllData}
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              {t.deleteConfirmDesc}
            </p>
            <ul
              className="text-sm mb-4 list-disc list-inside space-y-1"
              style={{ color: "var(--text-muted)" }}
            >
              <li>{t.deleteItem1}</li>
              <li>{t.deleteItem2}</li>
              <li>{t.deleteItem3}</li>
            </ul>
            <p className="text-sm mb-2" style={{ color: "var(--text)" }}>
              {t.typeDeleteToConfirm}
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="delete"
              className="w-full px-3 py-2 text-sm rounded-lg border mb-4 outline-none focus:ring-2 focus:ring-red-500"
              style={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteInput("");
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteInput !== "delete" || isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 disabled:hover:bg-red-600"
              >
                {isDeleting ? t.deleting : t.deleteEverything}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowImportModal(false);
              setSelectedFile(null);
            }}
          />
          <div
            className="relative z-10 w-full max-w-md p-6 rounded-xl border shadow-xl"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--text)" }}
            >
              {t.importData}
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              {t.importConfirmDesc}
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--text)" }}>
              {t.file} <strong>{selectedFile?.name}</strong>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 disabled:hover:bg-blue-600"
              >
                {isImporting ? t.importing : t.import}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
