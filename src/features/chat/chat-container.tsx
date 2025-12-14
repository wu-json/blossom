import { Header } from "./header";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

export function ChatContainer() {
  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--background)" }}
    >
      <Header />
      <MessageList />
      <ChatInput />
    </div>
  );
}
