"use client";

import { useAiChat } from "./AiChatContext";
import AiChatPanel from "./AiChatPanel";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isOpen } = useAiChat();
  return (
    <div className="flex min-h-screen">
      {children}
      {isOpen && <AiChatPanel />}
    </div>
  );
}
