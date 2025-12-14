import * as React from "react";
import { Sidebar } from "../sidebar";
import { ChatContainer } from "../../features/chat";
import { SettingsPage } from "../../features/settings";
import { TeacherPage } from "../../features/teacher";
import { GardenPage } from "../../features/garden";
import { useChatStore } from "../../store/chat-store";

export function AppLayout() {
  const currentView = useChatStore((state) => state.currentView);

  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 h-full min-w-0 overflow-hidden">
        {currentView === "chat" && <ChatContainer />}
        {currentView === "garden" && <GardenPage />}
        {currentView === "teacher" && <TeacherPage />}
        {currentView === "settings" && <SettingsPage />}
      </div>
    </div>
  );
}
