import * as React from "react";
import { MessageSquare, Settings } from "lucide-react";
import { useChatStore } from "../../store/chat-store";
import type { Language, View } from "../../types/chat";
import { cn } from "../../lib/utils";

const translations: Record<Language, { chat: string; settings: string }> = {
  ja: { chat: "チャット", settings: "設定" },
  zh: { chat: "聊天", settings: "设置" },
  ko: { chat: "채팅", settings: "설정" },
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

export function Sidebar() {
  const { sidebarCollapsed, currentView, setView, language } = useChatStore();
  const t = translations[language];

  const navItems: { icon: React.ReactNode; label: string; view: View }[] = [
    { icon: <MessageSquare size={18} />, label: t.chat, view: "chat" },
    { icon: <Settings size={18} />, label: t.settings, view: "settings" },
  ];

  if (sidebarCollapsed) {
    return null;
  }

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
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
      <aside
        className="flex flex-col h-full border-r"
        style={{
          width: "200px",
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Spacer matching header height */}
        <div className="h-[53px] flex-shrink-0" />
        <nav className="flex-1 px-3 pt-3 space-y-1">
          {navItems.map((item, index) => (
            <NavItem
              key={item.view}
              icon={item.icon}
              label={item.label}
              isActive={currentView === item.view}
              onClick={() => setView(item.view)}
              delay={index * 50}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
