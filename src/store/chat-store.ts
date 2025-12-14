import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatStore, Language, Message, MessageRole, Theme, View } from "../types/chat";

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isTyping: false,
      theme: "light" as Theme,
      language: "ja" as Language,
      sidebarCollapsed: true,
      currentView: "chat" as View,
      apiKeyConfigured: null,

      addMessage: (content: string, role: MessageRole) => {
        const newMessage: Message = {
          id: generateId(),
          role,
          content,
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages, newMessage],
        }));
        return newMessage.id;
      },

      setTyping: (isTyping: boolean) => {
        set({ isTyping });
      },

      toggleTheme: () => {
        set((state) => ({
          theme: state.theme === "light" ? "dark" : "light",
        }));
      },

      setLanguage: (language: Language) => {
        set({ language });
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      toggleSidebar: () => {
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        }));
      },

      setView: (view: View) => {
        set({ currentView: view });
      },

      updateMessage: (id: string, content: string) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content } : msg
          ),
        }));
      },

      checkApiKeyStatus: async () => {
        try {
          const response = await fetch("/api/status");
          const data = await response.json();
          set({ apiKeyConfigured: data.anthropicConfigured });
        } catch {
          set({ apiKeyConfigured: false });
        }
      },

      sendMessage: async (content: string) => {
        const { messages, updateMessage, setTyping } = get();

        // Add user message
        const userMessage: Message = {
          id: generateId(),
          role: "user",
          content,
          timestamp: new Date(),
        };

        // Add assistant message placeholder
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: "",
          timestamp: new Date(),
        };

        set((state) => ({
          messages: [...state.messages, userMessage, assistantMessage],
        }));

        setTyping(true);

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...messages, userMessage].map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to get response");
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("No reader available");

          const decoder = new TextDecoder();
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                    fullContent += parsed.delta.text;
                    updateMessage(assistantMessage.id, fullContent);
                  }
                } catch {
                  // Skip non-JSON lines
                }
              }
            }
          }
        } catch (error) {
          updateMessage(
            assistantMessage.id,
            "Sorry, there was an error getting a response. Please try again."
          );
        } finally {
          setTyping(false);
        }
      },
    }),
    {
      name: "blossom-chat-storage",
      partialize: (state) => ({ theme: state.theme, language: state.language, sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
