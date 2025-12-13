import * as React from "react";
import { Menu } from "lucide-react";
import { useChatStore } from "../../store/chat-store";

export function SettingsPage() {
  const toggleSidebar = useChatStore((state) => state.toggleSidebar);

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--background)" }}
    >
      <header
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center gap-3"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <h1
          className="text-base font-semibold"
          style={{ color: "var(--text)" }}
        >
          Settings
        </h1>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              Account
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Account settings coming soon.
            </p>
          </section>

          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              Preferences
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Preference settings coming soon.
            </p>
          </section>

          <section
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-sm font-medium mb-2"
              style={{ color: "var(--text)" }}
            >
              About
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Blossom v1.0.0
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
