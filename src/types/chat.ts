export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Theme = "light" | "dark";

export type Language = "ja" | "zh" | "ko";

export type View = "chat" | "settings" | "teacher";

export interface TeacherSettings {
  name: string;
  profileImagePath: string | null;
  personality: string | null;
}

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  theme: Theme;
  language: Language;
  sidebarCollapsed: boolean;
  currentView: View;
  apiKeyConfigured: boolean | null;
  currentConversationId: string | null;
  conversations: Conversation[];
  teacherSettings: TeacherSettings | null;
}

export interface ChatActions {
  addMessage: (content: string, role: MessageRole) => void;
  setTyping: (isTyping: boolean) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  clearMessages: () => void;
  toggleSidebar: () => void;
  setView: (view: View) => void;
  sendMessage: (content: string) => Promise<void>;
  updateMessage: (id: string, content: string) => void;
  checkApiKeyStatus: () => Promise<void>;
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => void;
  loadTeacherSettings: () => Promise<void>;
  updateTeacherName: (name: string) => Promise<void>;
  updateTeacherPersonality: (personality: string) => Promise<void>;
  uploadTeacherImage: (file: File) => Promise<void>;
  removeTeacherImage: () => Promise<void>;
  deleteAllData: () => Promise<void>;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
}

export type ChatStore = ChatState & ChatActions;
