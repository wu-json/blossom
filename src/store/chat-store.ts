import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatStore, Message, MessageRole, Theme } from "../types/chat";

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      isTyping: false,
      theme: "light" as Theme,

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
      },

      setTyping: (isTyping: boolean) => {
        set({ isTyping });
      },

      toggleTheme: () => {
        set((state) => ({
          theme: state.theme === "light" ? "dark" : "light",
        }));
      },

      clearMessages: () => {
        set({ messages: [] });
      },
    }),
    {
      name: "blossom-chat-storage",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
