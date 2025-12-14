import type { TranslationData, WordBreakdown } from "./translation";

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  translationData?: TranslationData;
  images?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Theme = "light" | "dark";

export type Language = "ja" | "zh" | "ko";

export type View = "chat" | "settings" | "teacher" | "garden";

export interface TeacherSettings {
  name: string;
  profileImagePath: string | null;
  personality: string | null;
}

export interface Petal {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  partOfSpeech: string;
  language: Language;
  conversationId: string;
  messageId: string;
  userInput: string;
  userImages?: string[];
  createdAt: Date;
}

export interface Flower {
  word: string;
  petalCount: number;
  latestReading: string;
  latestMeaning: string;
}

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  theme: Theme;
  language: Language;
  sidebarCollapsed: boolean;
  currentView: View;
  apiKeyConfigured: boolean | null;
  apiKeyPreview: string | null;
  dataDir: string | null;
  currentConversationId: string | null;
  conversations: Conversation[];
  teacherSettings: TeacherSettings | null;
  flowers: Flower[];
  selectedFlower: string | null;
  flowerPetals: Petal[];
}

export interface ChatActions {
  addMessage: (content: string, role: MessageRole) => void;
  setTyping: (isTyping: boolean) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  clearMessages: () => void;
  toggleSidebar: () => void;
  setView: (view: View) => void;
  sendMessage: (content: string, images?: string[]) => Promise<void>;
  updateMessage: (id: string, content: string) => void;
  checkApiKeyStatus: () => Promise<void>;
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => void;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  loadTeacherSettings: () => Promise<void>;
  updateTeacherName: (name: string) => Promise<void>;
  updateTeacherPersonality: (personality: string) => Promise<void>;
  uploadTeacherImage: (file: File) => Promise<void>;
  removeTeacherImage: () => Promise<void>;
  deleteAllData: () => Promise<void>;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  loadFlowers: () => Promise<void>;
  selectFlower: (word: string) => Promise<void>;
  clearSelectedFlower: () => void;
  savePetal: (word: WordBreakdown, conversationId: string, messageId: string, userInput: string, userImages?: string[]) => Promise<void>;
  deletePetal: (id: string) => Promise<void>;
}

export type ChatStore = ChatState & ChatActions;
