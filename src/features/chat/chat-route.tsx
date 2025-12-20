import { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useChatStore } from "../../store/chat-store";
import { ChatContainer } from "./chat-container";

export function ChatRoute() {
  const params = useParams<{ id?: string }>();
  const selectConversation = useChatStore((state) => state.selectConversation);
  const startNewChat = useChatStore((state) => state.startNewChat);
  const lastLoadedId = useRef<string | null>(null);

  useEffect(() => {
    const urlId = params.id;

    if (urlId) {
      // URL has a conversation ID - load it if different from current
      if (lastLoadedId.current !== urlId) {
        lastLoadedId.current = urlId;
        selectConversation(urlId);
      }
    } else {
      // No ID in URL - ensure we're in new chat mode
      if (lastLoadedId.current !== null) {
        lastLoadedId.current = null;
        startNewChat();
      }
    }
  }, [params.id, selectConversation, startNewChat]);

  return <ChatContainer />;
}
