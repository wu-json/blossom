import * as React from "react";
import { useState, useRef } from "react";
import { MenuIcon } from "../../components/icons/menu-icon";
import { useChatStore } from "../../store/chat-store";
import { version } from "../../version";

export function SettingsPage() {
  const { toggleSidebar, sidebarCollapsed, deleteAllData, exportData, importData, dataDir } = useChatStore();
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
              Data Storage
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Directory where Blossom stores your data. Configure with BLOSSOM_DATA_DIR environment variable.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Data directory:
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
              Export Data
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Download all your data as a backup file to transfer to another device.
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
              {isExporting ? "Exporting..." : "Export Data"}
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
              Import Data
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Restore your data from a backup file.
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
              {isImporting ? "Importing..." : "Import Data"}
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
              Danger Zone
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Permanently delete all Blossom data including conversations, messages, teacher settings, and uploaded files.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete All Data
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
              Delete All Data
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              This action cannot be undone. This will permanently delete:
            </p>
            <ul
              className="text-sm mb-4 list-disc list-inside space-y-1"
              style={{ color: "var(--text-muted)" }}
            >
              <li>All conversations and messages</li>
              <li>Teacher settings and profile image</li>
              <li>All uploaded files</li>
            </ul>
            <p className="text-sm mb-2" style={{ color: "var(--text)" }}>
              Type <strong>delete</strong> to confirm:
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
                Cancel
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteInput !== "delete" || isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 disabled:hover:bg-red-600"
              >
                {isDeleting ? "Deleting..." : "Delete Everything"}
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
              Import Data
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              This will replace all existing data with the contents of the backup file. This action cannot be undone.
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--text)" }}>
              File: <strong>{selectedFile?.name}</strong>
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
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 disabled:hover:bg-blue-600"
              >
                {isImporting ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
