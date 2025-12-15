import { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useChatStore } from "../../store/chat-store";
import { ChatContainer } from "./chat-container";

export function ChatRoute() {
  const params = useParams<{ id?: string }>();
  const currentConversationId = useChatStore((state) => state.currentConversationId);
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
      if (currentConversationId !== null) {
        lastLoadedId.current = null;
        startNewChat();
      }
    }
  }, [params.id, currentConversationId, selectConversation, startNewChat]);

  return <ChatContainer />;
}
