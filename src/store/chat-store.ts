import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatStore, Conversation, Language, Message, MessageRole, TeacherSettings, Theme, View } from "../types/chat";

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
      currentConversationId: null,
      conversations: [],
      teacherSettings: null,

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

      loadConversations: async () => {
        try {
          const response = await fetch("/api/conversations");
          const data = await response.json();
          const conversations: Conversation[] = data.map((c: { id: string; title: string; created_at: number; updated_at: number }) => ({
            id: c.id,
            title: c.title,
            createdAt: new Date(c.created_at),
            updatedAt: new Date(c.updated_at),
          }));
          set({ conversations });
        } catch {
          console.error("Failed to load conversations");
        }
      },

      createConversation: async () => {
        try {
          const response = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "New Conversation" }),
          });
          const data = await response.json();
          const conversation: Conversation = {
            id: data.id,
            title: data.title,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
          };
          set((state) => ({
            conversations: [conversation, ...state.conversations].slice(0, 10),
            currentConversationId: conversation.id,
            messages: [],
          }));
          return conversation.id;
        } catch {
          console.error("Failed to create conversation");
          return "";
        }
      },

      selectConversation: async (id: string) => {
        try {
          const response = await fetch(`/api/conversations/${id}`);
          const data = await response.json();
          const messages: Message[] = data.messages.map((m: { id: string; role: string; content: string; timestamp: number }) => ({
            id: m.id,
            role: m.role as MessageRole,
            content: m.content,
            timestamp: new Date(m.timestamp),
          }));
          set({
            currentConversationId: id,
            messages,
            currentView: "chat" as View,
          });
        } catch {
          console.error("Failed to load conversation");
        }
      },

      startNewChat: () => {
        set({
          currentConversationId: null,
          messages: [],
          currentView: "chat" as View,
        });
      },

      loadTeacherSettings: async () => {
        try {
          const response = await fetch("/api/teacher");
          const data = await response.json();
          set({
            teacherSettings: {
              name: data.name,
              profileImagePath: data.profileImagePath,
              personality: data.personality,
            },
          });
        } catch {
          console.error("Failed to load teacher settings");
        }
      },

      updateTeacherName: async (name: string) => {
        try {
          await fetch("/api/teacher", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          set((state) => ({
            teacherSettings: state.teacherSettings
              ? { ...state.teacherSettings, name }
              : { name, profileImagePath: null, personality: null },
          }));
        } catch {
          console.error("Failed to update teacher name");
        }
      },

      updateTeacherPersonality: async (personality: string) => {
        try {
          await fetch("/api/teacher/personality", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personality }),
          });
          set((state) => ({
            teacherSettings: state.teacherSettings
              ? { ...state.teacherSettings, personality: personality || null }
              : { name: "Blossom", profileImagePath: null, personality: personality || null },
          }));
        } catch {
          console.error("Failed to update teacher personality");
        }
      },

      uploadTeacherImage: async (file: File) => {
        try {
          const formData = new FormData();
          formData.append("image", file);
          const response = await fetch("/api/teacher/image", {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          set((state) => ({
            teacherSettings: state.teacherSettings
              ? { ...state.teacherSettings, profileImagePath: data.path }
              : { name: "Blossom", profileImagePath: data.path, personality: null },
          }));
        } catch {
          console.error("Failed to upload teacher image");
        }
      },

      removeTeacherImage: async () => {
        try {
          await fetch("/api/teacher/image", { method: "DELETE" });
          set((state) => ({
            teacherSettings: state.teacherSettings
              ? { ...state.teacherSettings, profileImagePath: null }
              : null,
          }));
        } catch {
          console.error("Failed to remove teacher image");
        }
      },

      deleteAllData: async () => {
        try {
          await fetch("/api/data", { method: "DELETE" });
          localStorage.removeItem("blossom-chat-storage");
          window.location.reload();
        } catch {
          console.error("Failed to delete all data");
        }
      },

      sendMessage: async (content: string) => {
        const { messages, updateMessage, setTyping, createConversation, loadConversations, language } = get();
        let { currentConversationId } = get();

        // Create conversation if none exists
        if (!currentConversationId) {
          currentConversationId = await createConversation();
          if (!currentConversationId) {
            console.error("Failed to create conversation");
            return;
          }
        }

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

        // Save user message to database
        await fetch(`/api/conversations/${currentConversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content }),
        });

        setTyping(true);

        // Check if this is the first message (for title generation later)
        const isFirstMessage = messages.length === 0;

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...messages, userMessage].map((m) => ({
                role: m.role,
                content: m.content,
              })),
              language,
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

          // Save assistant message to database
          await fetch(`/api/conversations/${currentConversationId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "assistant", content: fullContent }),
          });

          // Generate title with Haiku after first exchange
          if (isFirstMessage && fullContent) {
            fetch(`/api/conversations/${currentConversationId}/title`, {
              method: "POST",
            }).then(() => loadConversations());
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
