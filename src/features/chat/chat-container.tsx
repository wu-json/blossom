import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

export function ChatContainer() {
  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ backgroundColor: "var(--background)" }}
    >
      <ChatHeader />
      <MessageList />
      <ChatInput />
    </div>
  );
}
