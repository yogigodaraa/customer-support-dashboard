"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PAGES = [
  { label: "Dashboard",   href: "/",          icon: "📊", sub: "Overview & stats" },
  { label: "Email",       href: "/gmail",      icon: "📧", sub: "Email conversations" },
  { label: "Intercom",    href: "/intercom",   icon: "💬", sub: "In-app chat" },
  { label: "Luciq",       href: "/luciq",      icon: "🐛", sub: "Bug reports" },
  { label: "Templates",   href: "/templates",  icon: "📝", sub: "Response templates" },
] as const;

interface SearchData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intercom?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gmail?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  luciq?: any[];
}

interface SavedSearch {
  id: string;
  name: string;
  query?: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchData | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => {
          if (!v) { setQuery(""); setResults(null); setSelectedIdx(0); }
          return !v;
        });
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Fetch saved searches when palette opens
  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/api/saved-searches`)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.savedSearches ?? []);
        setSavedSearches(list);
      })
      .catch(() => setSavedSearches([]));
  }, [open]);

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setResults(null); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
        const payload = isEmail ? { email: q } : { userId: q };
        const res = await axios.post(`${API}/api/search`, payload);
        setResults(res.data);
      } catch {
        setResults(null);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query]);

  const filteredPages = PAGES.filter(p =>
    !query ||
    p.label.toLowerCase().includes(query.toLowerCase()) ||
    p.sub.toLowerCase().includes(query.toLowerCase())
  );

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const totalItems = filteredPages.length + (results ? 2 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => (i + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => (i - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      // Simple: just pick the first filtered page
      if (filteredPages[0]) navigate(filteredPages[0].href);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 mx-4">

        {/* Search input */}
        <div className="flex items-center px-4 py-3.5 border-b border-gray-100 gap-3">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search customers or navigate to a page…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent border-0 focus:outline-none"
          />
          {searching && (
            <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
          )}
          <kbd className="hidden sm:block text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">

          {/* Customer search results */}
          {results && (
            <div className="p-2 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium px-3 py-1.5">Customer Results</p>
              {results.intercom?.[0] && (
                <PaletteRow
                  icon="💬"
                  label={results.intercom[0].name || results.intercom[0].email || "Unknown"}
                  sub={`Intercom · ${results.intercom[0].email || ""}`}
                  selected={selectedIdx === 0}
                  onClick={() => navigate("/intercom")}
                />
              )}
              {results.gmail?.[0] && (
                <PaletteRow
                  icon="📧"
                  label={results.gmail[0].name || results.gmail[0].email || "Unknown"}
                  sub={`Email · ${results.gmail[0].email || ""}`}
                  selected={selectedIdx === 1}
                  onClick={() => navigate("/gmail")}
                />
              )}
              {!results.intercom?.[0] && !results.gmail?.[0] && (
                <p className="text-sm text-gray-400 px-3 py-3">No customers matched "{query}"</p>
              )}
            </div>
          )}

          {/* Saved Searches — only shown when query is empty */}
          {!query && savedSearches.length > 0 && (
            <div className="p-2 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium px-3 py-1.5 flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 flex-shrink-0">
                  <path d="M3 2h10a1 1 0 011 1v1.586a1 1 0 01-.293.707L9 10v4l-2-1V10L3.293 5.293A1 1 0 013 4.586V3a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Saved Searches
              </p>
              {savedSearches.map(s => (
                <PaletteRow
                  key={s.id}
                  icon="🔖"
                  label={s.name}
                  sub={s.query ? `Query: ${s.query}` : "Saved search"}
                  onClick={() => navigate(`/gmail?q=${encodeURIComponent(s.name)}`)}
                />
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="p-2">
            <p className="text-xs text-gray-400 font-medium px-3 py-1.5">Navigate</p>
            {filteredPages.map((p, i) => (
              <PaletteRow
                key={p.href}
                icon={p.icon}
                label={p.label}
                sub={p.sub}
                selected={selectedIdx === i + (results ? 2 : 0)}
                onClick={() => navigate(p.href)}
              />
            ))}
            {filteredPages.length === 0 && (
              <p className="text-sm text-gray-400 px-3 py-3">No pages matched</p>
            )}
          </div>
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 flex items-center gap-4">
          <Hint keys={["↑", "↓"]} label="navigate" />
          <Hint keys={["↵"]} label="open" />
          <Hint keys={["⌘", "K"]} label="close" />
        </div>
      </div>
    </div>
  );
}

function PaletteRow({
  icon, label, sub, selected, onClick,
}: {
  icon: string; label: string; sub?: string; selected?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
        selected ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
    >
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </button>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400">
      {keys.map(k => (
        <kbd key={k} className="border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-500">{k}</kbd>
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  );
}
