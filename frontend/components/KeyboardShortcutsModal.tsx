"use client";

import { useEffect, useState } from "react";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { keys: ["⌘", "K"], description: "Open command palette", category: "Navigation" },
  { keys: ["⌘", "J"], description: "Toggle AI assistant", category: "Navigation" },
  { keys: ["⌘", "?"], description: "Show keyboard shortcuts", category: "Navigation" },

  // Composer
  { keys: ["⌘", "↵"], description: "Send reply", category: "Composer" },
  { keys: ["/"], description: "Insert template (empty editor)", category: "Composer" },
  { keys: ["Esc"], description: "Close template picker / emoji picker", category: "Composer" },
  { keys: ["⌘", "B"], description: "Bold text", category: "Composer" },
  { keys: ["⌘", "I"], description: "Italic text", category: "Composer" },
  { keys: ["⌘", "U"], description: "Underline text", category: "Composer" },
  { keys: ["⌘", "K"], description: "Insert hyperlink", category: "Composer" },

  // Conversations
  { keys: ["↑", "↓"], description: "Navigate conversation list", category: "Conversations" },
  { keys: ["Space"], description: "Select conversation (multi-select mode)", category: "Conversations" },
  { keys: ["Esc"], description: "Deselect all", category: "Conversations" },

  // AI Panel
  { keys: ["⌘", "↵"], description: "Send AI message", category: "AI" },
  { keys: ["Esc"], description: "Close AI panel", category: "AI" },
];

const CATEGORIES = [...new Set(SHORTCUTS.map(s => s.category))];

function KeyChip({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-mono font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm">
      {k}
    </kbd>
  );
}

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "?") {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
            <p className="text-xs text-gray-400 mt-0.5">Press <KeyChip k="⌘" /> + <KeyChip k="?" /> anytime to toggle</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm"
          >
            ✕
          </button>
        </div>

        {/* Shortcut list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {CATEGORIES.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</p>
              <div className="space-y-1.5">
                {SHORTCUTS.filter(s => s.category === cat).map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s.description}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {s.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          <KeyChip k={k} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-xs text-gray-400">Press <KeyChip k="Esc" /> to close</p>
        </div>
      </div>
    </div>
  );
}
