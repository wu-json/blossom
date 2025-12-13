export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export type Theme = "light" | "dark";

export type Language = "ja" | "zh" | "ko";

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  theme: Theme;
  language: Language;
}

export interface ChatActions {
  addMessage: (content: string, role: MessageRole) => void;
  setTyping: (isTyping: boolean) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  clearMessages: () => void;
}

export type ChatStore = ChatState & ChatActions;
