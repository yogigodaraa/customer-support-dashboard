"use client";

import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { useAiChat, type AiMessage } from "./AiChatContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="ai-typing-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="ai-typing-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="ai-typing-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function MessageBubble({ msg }: { msg: AiMessage }) {
  if (msg.role === "system") {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">
          {msg.content}
        </span>
      </div>
    );
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-emerald-600 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm shadow-sm border-l-2 border-l-emerald-400">
        {msg.isStreaming ? (
          <TypingDots />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
            {msg.content}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

const WIDTH_OPTIONS = [
  { label: "S", className: "w-64" },
  { label: "M", className: "w-80" },
  { label: "L", className: "w-96" },
] as const;

export default function AiChatPanel() {
  const {
    close,
    messages,
    sendMessage,
    conversationContext,
    clearChat,
    isLoading,
  } = useAiChat();

  const [input, setInput] = useState("");
  const [widthIdx, setWidthIdx] = useState(1); // default M
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
  }, [messages.length]);

  // Focus textarea when panel mounts
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 300);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  function handleSend() {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      close();
    }
  }

  return (
    <div className={`${WIDTH_OPTIONS[widthIdx].className} flex-shrink-0 h-screen sticky top-0 ai-panel-slide-in flex flex-col bg-white border-l border-gray-200`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <span className="font-semibold text-gray-900 text-sm">
              AI Assistant
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Width toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mr-1">
              {WIDTH_OPTIONS.map((opt, i) => (
                <button
                  key={opt.label}
                  onClick={() => setWidthIdx(i)}
                  title={`Panel width: ${opt.label}`}
                  className={`px-1.5 py-1 text-xs transition ${
                    i === widthIdx
                      ? "bg-emerald-100 text-emerald-700 font-medium"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear chat"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
            <button
              onClick={close}
              title="Close (Esc)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Context pill */}
        {conversationContext && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs">
              {conversationContext.source === "intercom"
                ? "💬"
                : conversationContext.source === "gmail"
                ? "📧"
                : "🐛"}
            </span>
            <span className="text-xs text-gray-500 truncate flex-1">
              {conversationContext.contactName} — {conversationContext.subject}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
              <span className="text-xl">✨</span>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              AI Support Assistant
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Ask me anything about the current conversation, or hover over a
              message and click the sparkle button to analyze it.
            </p>
            <div className="mt-4 space-y-1.5 w-full">
              {["Summarize this conversation", "Draft a reply", "Analyze sentiment"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="w-full text-left text-xs text-gray-500 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg px-3 py-2 transition"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI assistant..."
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-gray-400"
            style={{ minHeight: "38px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-1.5 text-center">
          <kbd className="border border-gray-200 rounded px-1">⌘</kbd>
          <kbd className="border border-gray-200 rounded px-1 ml-0.5">↵</kbd>
          <span className="ml-1">to send</span>
        </p>
      </div>
    </div>
  );
}
