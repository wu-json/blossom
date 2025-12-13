import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatStore, Language, Message, MessageRole, Theme, View } from "../types/chat";

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      isTyping: false,
      theme: "light" as Theme,
      language: "ja" as Language,
      sidebarCollapsed: true,
      currentView: "chat" as View,

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
    }),
    {
      name: "blossom-chat-storage",
      partialize: (state) => ({ theme: state.theme, language: state.language, sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
