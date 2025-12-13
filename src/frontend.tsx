import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ChatContainer } from "./features/chat/chat-container";
import { useChatStore } from "./store/chat-store";

function App() {
  const theme = useChatStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  return <ChatContainer />;
}

createRoot(document.getElementById("root")!).render(<App />);
