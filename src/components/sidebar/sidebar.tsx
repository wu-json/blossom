import * as React from "react";
import { MessageSquare, Settings, Plus, GraduationCap, Flower2 } from "lucide-react";
import { useLocation } from "wouter";
import { useChatStore } from "../../store/chat-store";
import { useNavigation } from "../../hooks/use-navigation";
import type { Conversation, Language } from "../../types/chat";
import { cn } from "../../lib/utils";

const translations: Record<Language, { chat: string; settings: string; teacher: string; garden: string; newChat: string; conversations: string }> = {
  ja: { chat: "チャット", settings: "設定", teacher: "先生", garden: "花園", newChat: "新しいチャット", conversations: "履歴" },
  zh: { chat: "聊天", settings: "设置", teacher: "老师", garden: "花园", newChat: "新聊天", conversations: "历史" },
  ko: { chat: "채팅", settings: "설정", teacher: "선생님", garden: "정원", newChat: "새 채팅", conversations: "기록" },
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  delay: number;
}

function NavItem({ icon, label, isActive, onClick, delay }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl",
        "transition-all duration-200 ease-out",
        "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
      )}
      style={{
        animation: `slideIn 0.3s ease-out ${delay}ms both`,
      }}
    >
      {/* Active indicator line */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-200"
        style={{
          height: isActive ? "60%" : "0%",
          backgroundColor: "var(--primary)",
          opacity: isActive ? 1 : 0,
        }}
      />

      {/* Soft background glow for active state */}
      <div
        className="absolute inset-0 rounded-xl transition-opacity duration-200"
        style={{
          background: isActive
            ? "linear-gradient(90deg, rgba(236, 72, 153, 0.08) 0%, rgba(236, 72, 153, 0.02) 100%)"
            : "transparent",
          opacity: isActive ? 1 : 0,
        }}
      />

      <span
        className="relative flex-shrink-0 transition-all duration-200"
        style={{
          color: isActive ? "var(--primary)" : "var(--text-muted)",
          transform: isActive ? "scale(1.05)" : "scale(1)",
        }}
      >
        {icon}
      </span>

      <span
        className="relative text-sm transition-all duration-200"
        style={{
          color: isActive ? "var(--text)" : "var(--text-muted)",
          fontWeight: isActive ? 500 : 400,
        }}
      >
        {label}
      </span>
    </button>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const [expandedPos, setExpandedPos] = React.useState({ top: 0, left: 0 });
  const textRef = React.useRef<HTMLSpanElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [conversation.title]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setExpandedPos({ top: rect.top, left: rect.left });
    }
  };

  const showExpanded = isHovered && isTruncated;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "group relative flex items-center w-full px-3 py-2 rounded-lg text-left",
          "transition-all duration-200 ease-out",
          "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
        )}
      >
        {/* Active indicator */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full transition-all duration-200"
          style={{
            height: isActive ? "50%" : "0%",
            backgroundColor: "var(--primary)",
            opacity: isActive ? 1 : 0,
          }}
        />

        {/* Regular truncated title */}
        <span
          ref={textRef}
          className="text-sm truncate"
          style={{
            color: isActive ? "var(--text)" : "var(--text-muted)",
            fontWeight: isActive ? 500 : 400,
          }}
        >
          {conversation.title}
        </span>
      </button>

      {/* Expanded title on hover - fixed position to escape overflow */}
      {showExpanded && (
        <div
          className="fixed text-sm whitespace-nowrap px-3 py-2 rounded-lg pointer-events-none"
          style={{
            top: expandedPos.top,
            left: expandedPos.left,
            color: "var(--text)",
            fontWeight: isActive ? 500 : 400,
            backgroundColor: "var(--surface)",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.12)",
            border: "1px solid var(--border)",
            zIndex: 9999,
            animation: "expandTitle 0.15s ease-out",
          }}
        >
          {conversation.title}
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  const {
    sidebarCollapsed,
    language,
    conversations,
    currentConversationId,
    selectedFlower,
  } = useChatStore();
  const [location] = useLocation();
  const { navigateToChat, navigateToGarden, navigateToTeacher, navigateToSettings } = useNavigation();
  const t = translations[language];

  // Preserve chat state when navigating back to chat
  const handleChatClick = () => {
    if (currentConversationId) {
      navigateToChat(currentConversationId);
    } else {
      navigateToChat();
    }
  };

  // Preserve garden state when navigating back to garden
  const handleGardenClick = () => {
    if (selectedFlower) {
      navigateToGarden(selectedFlower);
    } else {
      navigateToGarden();
    }
  };

  const navItems: { icon: React.ReactNode; label: string; path: string; onClick: () => void }[] = [
    { icon: <MessageSquare size={18} />, label: t.chat, path: "/chat", onClick: handleChatClick },
    { icon: <Flower2 size={18} />, label: t.garden, path: "/garden", onClick: handleGardenClick },
    { icon: <GraduationCap size={18} />, label: t.teacher, path: "/teacher", onClick: () => navigateToTeacher() },
    { icon: <Settings size={18} />, label: t.settings, path: "/settings", onClick: () => navigateToSettings() },
  ];

  const isActivePath = (path: string) => location === path || location.startsWith(path + "/");

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-8px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes expandTitle {
            from {
              opacity: 0;
              transform: translateX(-4px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
      <aside
        className="flex flex-col h-full border-r overflow-hidden"
        style={{
          width: sidebarCollapsed ? "0px" : "240px",
          opacity: sidebarCollapsed ? 0 : 1,
          backgroundColor: "var(--surface)",
          borderColor: sidebarCollapsed ? "transparent" : "var(--border)",
          transition: "width 0.2s ease-out, opacity 0.15s ease-out, border-color 0.2s ease-out",
        }}
      >
        <div style={{ minWidth: "240px" }}>
        {/* Spacer matching header height */}
        <div className="h-[53px] flex-shrink-0" />

        {/* New Chat Button */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => navigateToChat()}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-xl",
              "transition-all duration-200 ease-out",
              "border border-dashed",
              "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
            )}
            style={{
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <Plus size={16} />
            <span className="text-sm">{t.newChat}</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 pt-3 space-y-1">
          {navItems.map((item, index) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              isActive={isActivePath(item.path)}
              onClick={item.onClick}
              delay={index * 50}
            />
          ))}
        </nav>

        {/* Conversation History */}
        {conversations.length > 0 && (
          <div className="flex-1 px-3 pt-4 overflow-hidden flex flex-col">
            <div
              className="text-xs font-medium mb-2 px-3"
              style={{ color: "var(--text-muted)" }}
            >
              {t.conversations}
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={currentConversationId === conversation.id}
                  onClick={() => navigateToChat(conversation.id)}
                />
              ))}
            </div>
          </div>
        )}
        </div>
      </aside>
    </>
  );
}
