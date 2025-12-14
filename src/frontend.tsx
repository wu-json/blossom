import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppLayout } from "./components/layout";
import { useChatStore } from "./store/chat-store";

function App() {
  const theme = useChatStore((state) => state.theme);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const checkApiKeyStatus = useChatStore((state) => state.checkApiKeyStatus);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    loadConversations();
    checkApiKeyStatus();
  }, [loadConversations, checkApiKeyStatus]);

  return <AppLayout />;
}

createRoot(document.getElementById("root")!).render(<App />);
