import { useEffect, useState, useRef } from "react";
import { AlertTriangle, ChevronDown, Pencil, Trash2, RefreshCw } from "lucide-react";
import { HeaderControls } from "../../components/ui/header-controls";
import { MenuIcon } from "../../components/icons/menu-icon";
import { useChatStore } from "../../store/chat-store";
import { version } from "../../version";

export function Header() {
  const {
    theme,
    toggleSidebar,
    sidebarCollapsed,
    apiKeyConfigured,
    checkApiKeyStatus,
    currentConversationId,
    conversations,
    currentView,
    renameConversation,
    deleteConversation,
    loadConversations,
  } = useChatStore();
  const isDark = theme === "dark";

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const currentConversation = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)
    : null;

  useEffect(() => {
    checkApiKeyStatus();
  }, [checkApiKeyStatus]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Handle escape key for delete confirmation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDeleteConfirm) {
        setShowDeleteConfirm(false);
      }
    };
    if (showDeleteConfirm) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteConfirm]);

  const handleRenameClick = () => {
    if (currentConversation) {
      setRenameValue(currentConversation.title);
      setIsRenaming(true);
      setIsDropdownOpen(false);
    }
  };

  const handleRenameSubmit = async () => {
    if (currentConversationId && renameValue.trim()) {
      await renameConversation(currentConversationId, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setIsDropdownOpen(false);
  };

  const confirmDelete = async () => {
    if (currentConversationId) {
      await deleteConversation(currentConversationId);
    }
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleRegenerateTitle = async () => {
    if (currentConversationId) {
      setIsDropdownOpen(false);
      setIsRegenerating(true);
      try {
        await fetch(`/api/conversations/${currentConversationId}/title`, {
          method: "POST",
        });
        await loadConversations();
      } finally {
        setIsRegenerating(false);
      }
    }
  };

  return (
    <header
      className="flex items-center justify-between px-4 py-3"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-2 p-1.5 -ml-1.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Toggle sidebar"
        >
          <MenuIcon isOpen={sidebarCollapsed} />
          <h1 className="text-base font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            blossom
          </h1>
          <span className="text-sm self-end mb-[2px]" style={{ color: "var(--text-muted)" }}>
            v{version}
          </span>
          {apiKeyConfigured === false && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:scale-105"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)"
                  : "linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%)",
                color: isDark ? "#FCD34D" : "#B45309",
                border: isDark ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                boxShadow: isDark
                  ? "0 2px 8px rgba(251, 191, 36, 0.1)"
                  : "0 2px 8px rgba(245, 158, 11, 0.1)",
              }}
              title="Set ANTHROPIC_API_KEY environment variable to enable AI responses"
            >
              <AlertTriangle className="w-3 h-3" />
              ANTHROPIC_API_KEY not set
            </span>
          )}
        </button>

        {/* Chat title with dropdown - only show when conversation is open in chat view */}
        {currentView === "chat" && currentConversation && (
          <div className="relative" ref={dropdownRef}>
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
                className="px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none"
                style={{
                  color: "var(--text)",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--primary)",
                  minWidth: "200px",
                  maxWidth: "400px",
                }}
              />
            ) : (
              <button
                onClick={() => !isRegenerating && setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  color: "var(--text)",
                  cursor: isRegenerating ? "default" : "pointer",
                }}
              >
                {isRegenerating && (
                  <RefreshCw
                    className="w-3.5 h-3.5 flex-shrink-0 animate-spin"
                    style={{ color: "var(--text-muted)" }}
                  />
                )}
                <span
                  className="text-sm font-medium truncate transition-opacity duration-200"
                  style={{
                    maxWidth: "300px",
                    opacity: isRegenerating ? 0.5 : 1,
                  }}
                >
                  {currentConversation.title}
                </span>
                {!isRegenerating && (
                  <ChevronDown
                    className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
                    style={{
                      color: "var(--text-muted)",
                      transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                )}
              </button>
            )}

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg z-50"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  minWidth: "140px",
                }}
              >
                <button
                  onClick={handleRenameClick}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--text)" }}
                >
                  <Pencil className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  Rename
                </button>
                <button
                  onClick={handleRegenerateTitle}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--text)" }}
                >
                  <RefreshCw className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  Regenerate title
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-red-500/10"
                  style={{ color: "#EF4444" }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <HeaderControls />

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
          }}
          onClick={cancelDelete}
        >
          <div
            className="p-6 rounded-xl shadow-xl"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              width: "320px",
              animation: "fadeIn 150ms ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-base font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              Delete conversation?
            </h3>
            <p
              className="text-sm mb-6 truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {currentConversation?.title}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: "#EF4444",
                  color: "white",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
