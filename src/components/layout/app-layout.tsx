import * as React from "react";
import { Sidebar } from "../sidebar";
import { ChatContainer } from "../../features/chat";
import { SettingsPage } from "../../features/settings";
import { useChatStore } from "../../store/chat-store";

export function AppLayout() {
  const currentView = useChatStore((state) => state.currentView);

  return (
    <div className="flex h-dvh w-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {currentView === "chat" && <ChatContainer />}
        {currentView === "settings" && <SettingsPage />}
      </div>
    </div>
  );
}
