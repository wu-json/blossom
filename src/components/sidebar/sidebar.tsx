import * as React from "react";
import { MessageSquare, Settings } from "lucide-react";
import { useChatStore } from "../../store/chat-store";
import type { View } from "../../types/chat";
import { cn } from "../../lib/utils";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors duration-150",
        "hover:bg-black/5 dark:hover:bg-white/5"
      )}
      style={{
        backgroundColor: isActive ? "var(--primary)" : "transparent",
        color: isActive ? "white" : "var(--text-muted)",
      }}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-sm font-medium truncate">{label}</span>
    </button>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, currentView, setView } = useChatStore();

  const navItems: { icon: React.ReactNode; label: string; view: View }[] = [
    { icon: <MessageSquare size={20} />, label: "Chat", view: "chat" },
    { icon: <Settings size={20} />, label: "Settings", view: "settings" },
  ];

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        width: "200px",
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            isActive={currentView === item.view}
            onClick={() => setView(item.view)}
          />
        ))}
      </nav>
    </aside>
  );
}
