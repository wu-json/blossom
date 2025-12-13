export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export type Theme = "light" | "dark";

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  theme: Theme;
}

export interface ChatActions {
  addMessage: (content: string, role: MessageRole) => void;
  setTyping: (isTyping: boolean) => void;
  toggleTheme: () => void;
  clearMessages: () => void;
}

export type ChatStore = ChatState & ChatActions;
