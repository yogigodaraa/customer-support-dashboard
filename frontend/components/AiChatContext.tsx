"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConversationContext {
  source: "intercom" | "gmail" | "luciq";
  conversationId: string;
  subject: string;
  contactName: string;
  contactEmail: string;
  messages: Array<{
    from: string;
    body: string;
    isInbound: boolean;
    createdAt: string;
  }>;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface AiChatContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  messages: AiMessage[];
  sendMessage: (content: string) => Promise<void>;
  injectContext: (ctx: ConversationContext) => void;
  insertMessage: (messageBody: string, fromName: string) => void;
  conversationContext: ConversationContext | null;
  clearChat: () => void;
  isLoading: boolean;
}

const AiChatContext = createContext<AiChatContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

let nextId = 1;
function uid() {
  return `ai-${nextId++}-${Date.now()}`;
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationContext, setConversationContext] =
    useState<ConversationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = useCallback(() => setIsOpen((p) => !p), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const clearChat = useCallback(() => setMessages([]), []);

  // ⌘J keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggle]);

  const injectContext = useCallback((ctx: ConversationContext) => {
    setConversationContext(ctx);
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "system",
        content: `Context updated: ${ctx.subject} from ${ctx.contactName}`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMsg: AiMessage = {
        id: uid(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      const assistantId = uid();
      const assistantMsg: AiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      try {
        const history = messages
          .filter((m) => m.role !== "system")
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await axios.post(`${API}/api/ai/chat`, {
          message: content.trim(),
          conversationContext,
          history,
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: res.data.reply, isStreaming: false }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, I couldn't process that request. Please try again.",
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, conversationContext]
  );

  const insertMessage = useCallback(
    (messageBody: string, fromName: string) => {
      setIsOpen(true);
      // Small delay so the panel is open before sending
      setTimeout(() => {
        const content = `Analyze this message from ${fromName}:\n\n> ${messageBody}`;
        sendMessage(content);
      }, 100);
    },
    [sendMessage]
  );

  return (
    <AiChatContext.Provider
      value={{
        isOpen,
        toggle,
        open,
        close,
        messages,
        sendMessage,
        injectContext,
        insertMessage,
        conversationContext,
        clearChat,
        isLoading,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAiChat() {
  const ctx = useContext(AiChatContext);
  if (!ctx) throw new Error("useAiChat must be used within AiChatProvider");
  return ctx;
}
