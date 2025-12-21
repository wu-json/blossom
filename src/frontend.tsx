import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import "./index.css";
import { AppLayout } from "./components/layout";
import { useChatStore } from "./store/chat-store";

function App() {
  const theme = useChatStore((state) => state.theme);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const checkApiKeyStatus = useChatStore((state) => state.checkApiKeyStatus);
  const loadTeacherSettings = useChatStore((state) => state.loadTeacherSettings);
  const toggleSidebar = useChatStore((state) => state.toggleSidebar);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    loadConversations();
    checkApiKeyStatus();
    loadTeacherSettings();
  }, [loadConversations, checkApiKeyStatus, loadTeacherSettings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key === "[") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return <AppLayout />;
}

createRoot(document.getElementById("root")!).render(
  <Router>
    <App />
  </Router>
);
