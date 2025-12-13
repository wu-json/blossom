import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AppLayout } from "./components/layout";
import { useChatStore } from "./store/chat-store";

function App() {
  const theme = useChatStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  return <AppLayout />;
}

createRoot(document.getElementById("root")!).render(<App />);
