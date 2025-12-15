import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatStore, Conversation, Flower, Language, Message, MessageRole, Petal, TeacherSettings, Theme, View } from "../types/chat";
import type { WordBreakdown } from "../types/translation";

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
      apiKeyPreview: null,
      dataDir: null,
      currentConversationId: null,
      conversations: [],
      teacherSettings: null,
      flowers: [],
      selectedFlower: null,
      flowerPetals: [],
      savedPetalWords: {},

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
          set({
            apiKeyConfigured: data.anthropicConfigured,
            apiKeyPreview: data.anthropicKeyPreview,
            dataDir: data.dataDir,
          });
        } catch {
          set({ apiKeyConfigured: false, apiKeyPreview: null, dataDir: null });
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
          // Fetch conversation and saved petals in parallel
          const [conversationResponse, petalsResponse] = await Promise.all([
            fetch(`/api/conversations/${id}`),
            fetch(`/api/petals/conversation/${id}`),
          ]);
          const data = await conversationResponse.json();
          const petalsData = await petalsResponse.json();

          const messages: Message[] = data.messages.map((m: { id: string; role: string; content: string; timestamp: number; images: string | null }) => ({
            id: m.id,
            role: m.role as MessageRole,
            content: m.content,
            timestamp: new Date(m.timestamp),
            images: m.images ? JSON.parse(m.images) : undefined,
          }));

          // Build savedPetalWords from petals data
          const savedPetalWords: Record<string, string[]> = {};
          for (const petal of petalsData) {
            const messageId = petal.message_id;
            if (!savedPetalWords[messageId]) {
              savedPetalWords[messageId] = [];
            }
            savedPetalWords[messageId].push(petal.word);
          }

          set({
            currentConversationId: id,
            messages,
            savedPetalWords,
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
          savedPetalWords: {},
          currentView: "chat" as View,
        });
      },

      renameConversation: async (id: string, title: string) => {
        try {
          await fetch(`/api/conversations/${id}/title`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          });
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, title } : c
            ),
          }));
        } catch {
          console.error("Failed to rename conversation");
        }
      },

      deleteConversation: async (id: string) => {
        try {
          await fetch(`/api/conversations/${id}`, {
            method: "DELETE",
          });
          const { currentConversationId, startNewChat } = get();
          set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== id),
          }));
          if (currentConversationId === id) {
            startNewChat();
          }
        } catch {
          console.error("Failed to delete conversation");
        }
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

      exportData: async () => {
        try {
          const response = await fetch("/api/data/export");
          if (!response.ok) throw new Error("Export failed");
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          a.download = `blossom-backup-${timestamp}.zip`;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          console.error("Failed to export data");
          throw new Error("Failed to export data");
        }
      },

      importData: async (file: File) => {
        try {
          const formData = new FormData();
          formData.append("backup", file);
          const response = await fetch("/api/data/import", {
            method: "POST",
            body: formData,
          });
          if (!response.ok) throw new Error("Import failed");
          localStorage.removeItem("blossom-chat-storage");
          window.location.reload();
        } catch {
          console.error("Failed to import data");
          throw new Error("Failed to import data");
        }
      },

      loadFlowers: async () => {
        const { language } = get();
        try {
          const response = await fetch(`/api/petals/flowers?language=${language}`);
          const data = await response.json();
          const flowers: Flower[] = data.map((f: { word: string; petalCount: number; latestReading: string; latestMeaning: string }) => ({
            word: f.word,
            petalCount: f.petalCount,
            latestReading: f.latestReading,
            latestMeaning: f.latestMeaning,
          }));
          set({ flowers });
        } catch {
          console.error("Failed to load flowers");
        }
      },

      selectFlower: async (word: string) => {
        const { language } = get();
        try {
          const response = await fetch(`/api/petals/flower/${encodeURIComponent(word)}?language=${language}`);
          const data = await response.json();
          const petals: Petal[] = data.map((p: { id: string; word: string; reading: string; meaning: string; part_of_speech: string; language: string; conversation_id: string; message_id: string; user_input: string; user_images: string | null; created_at: number }) => ({
            id: p.id,
            word: p.word,
            reading: p.reading,
            meaning: p.meaning,
            partOfSpeech: p.part_of_speech,
            language: p.language as Language,
            conversationId: p.conversation_id,
            messageId: p.message_id,
            userInput: p.user_input,
            userImages: p.user_images ? JSON.parse(p.user_images) : undefined,
            createdAt: new Date(p.created_at),
          }));
          set({ selectedFlower: word, flowerPetals: petals });
        } catch {
          console.error("Failed to load flower petals");
        }
      },

      clearSelectedFlower: () => {
        set({ selectedFlower: null, flowerPetals: [] });
      },

      savePetal: async (word: WordBreakdown, conversationId: string, messageId: string, userInput: string, userImages?: string[]) => {
        const { language, loadFlowers } = get();
        try {
          const response = await fetch("/api/petals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              word: word.word,
              reading: word.reading,
              meaning: word.meaning,
              partOfSpeech: word.partOfSpeech,
              language,
              conversationId,
              messageId,
              userInput,
              userImages,
            }),
          });
          const data = await response.json();
          if (data.id) {
            // Successfully saved - update local savedPetalWords
            set((state) => {
              const existing = state.savedPetalWords[messageId] || [];
              return {
                savedPetalWords: {
                  ...state.savedPetalWords,
                  [messageId]: [...existing, word.word],
                },
              };
            });
          }
          await loadFlowers();
        } catch {
          console.error("Failed to save petal");
        }
      },

      deletePetal: async (id: string) => {
        const { selectedFlower, selectFlower, loadFlowers } = get();
        try {
          await fetch(`/api/petals/${id}`, { method: "DELETE" });
          await loadFlowers();
          // Refresh current flower view if one is selected
          if (selectedFlower) {
            const { flowers } = get();
            // Check if the flower still exists after deletion
            const flowerStillExists = flowers.some(f => f.word === selectedFlower);
            if (flowerStillExists) {
              await selectFlower(selectedFlower);
            } else {
              set({ selectedFlower: null, flowerPetals: [] });
            }
          }
        } catch {
          console.error("Failed to delete petal");
        }
      },

      removePetalFromMessage: async (messageId: string, word: string) => {
        const { loadFlowers } = get();
        try {
          const response = await fetch(`/api/petals/message/${messageId}/word/${encodeURIComponent(word)}`, {
            method: "DELETE",
          });
          if (response.ok) {
            // Update local savedPetalWords
            set((state) => {
              const existing = state.savedPetalWords[messageId] || [];
              const updated = existing.filter(w => w !== word);
              const newSavedPetalWords = { ...state.savedPetalWords };
              if (updated.length === 0) {
                delete newSavedPetalWords[messageId];
              } else {
                newSavedPetalWords[messageId] = updated;
              }
              return { savedPetalWords: newSavedPetalWords };
            });
            await loadFlowers();
            return true;
          }
          return false;
        } catch {
          console.error("Failed to remove petal");
          return false;
        }
      },

      sendMessage: async (content: string, images?: string[]) => {
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
          images,
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
          isTyping: true,
        }));

        // Save user message to database
        await fetch(`/api/conversations/${currentConversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content, images }),
        });

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
                images: m.images,
              })),
              language,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "unknown" }));
            if (response.status === 413 || errorData.error === "request_too_large") {
              throw new Error("CONVERSATION_TOO_LARGE");
            }
            if (response.status === 429 || errorData.error === "rate_limited") {
              throw new Error("RATE_LIMITED");
            }
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
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ language }),
            }).then(() => loadConversations());
          }
        } catch (error) {
          let errorMessage: string;

          if (error instanceof Error) {
            switch (error.message) {
              case "CONVERSATION_TOO_LARGE":
                errorMessage = "This conversation has grown too long. Please start a new chat to continue.";
                break;
              case "RATE_LIMITED":
                errorMessage = "Too many requests. Please wait a moment and try again.";
                break;
              default:
                errorMessage = "Sorry, there was an error getting a response. Please try again.";
            }
          } else {
            errorMessage = "Sorry, there was an error getting a response. Please try again.";
          }

          updateMessage(assistantMessage.id, errorMessage);
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
