"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown> | null;
  createdAt: string;
}

interface SavedSearchesProps {
  currentQuery: string;
  currentFilters: Record<string, unknown>;
  onLoad: (query: string, filters: Record<string, unknown>) => void;
}

export default function SavedSearches({
  currentQuery,
  currentFilters,
  onLoad,
}: SavedSearchesProps) {
  const { toast } = useToast();

  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const canSave =
    currentQuery.trim().length > 0 ||
    Object.keys(currentFilters).length > 0;

  const fetchSearches = useCallback(async () => {
    try {
      const res = await axios.get<SavedSearch[]>(`${API}/api/saved-searches`);
      setSearches(res.data);
    } catch {
      // Silently ignore fetch errors — the feature is non-critical
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!popoverOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
        setNameInput("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popoverOpen]);

  // Focus name input when popover opens
  useEffect(() => {
    if (popoverOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [popoverOpen]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLoadingDelete(id);
    try {
      await axios.delete(`${API}/api/saved-searches/${id}`);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast("Failed to delete saved search", "error");
    } finally {
      setLoadingDelete(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      await axios.post(`${API}/api/saved-searches`, {
        name: trimmedName,
        query: currentQuery,
        filters: currentFilters,
      });
      await fetchSearches();
      setPopoverOpen(false);
      setNameInput("");
      toast("Search saved");
    } catch {
      toast("Failed to save search", "error");
    } finally {
      setSaving(false);
    }
  }

  function handlePopoverKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setPopoverOpen(false);
      setNameInput("");
    }
  }

  // Render nothing when there are no saved searches and the save button would be disabled
  if (searches.length === 0 && !canSave) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-2 flex-wrap py-1"
    >
      {searches.map((search) => (
        <button
          key={search.id}
          type="button"
          onClick={() => onLoad(search.query, search.filters ?? {})}
          className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-0.5 text-xs font-medium hover:bg-blue-100 transition cursor-pointer group"
        >
          <span>{search.name}</span>
          <span
            role="button"
            aria-label={`Remove "${search.name}"`}
            onClick={(e) =>
              loadingDelete !== search.id ? handleDelete(search.id, e) : e.stopPropagation()
            }
            className="text-blue-400 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition leading-none"
          >
            {loadingDelete === search.id ? (
              <svg
                className="w-3 h-3 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : (
              <svg
                className="w-3 h-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            )}
          </span>
        </button>
      ))}

      {/* Save button + popover */}
      <div className="relative">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            if (canSave) setPopoverOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>&#128190;</span>
          <span>Save search</span>
        </button>

        {popoverOpen && (
          <div
            className="absolute z-30 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-3 min-w-56"
            onKeyDown={handlePopoverKeyDown}
          >
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Name this search
            </p>
            <form onSubmit={handleSave} className="flex flex-col gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Open Intercom bugs"
                maxLength={64}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 placeholder-gray-300 text-gray-800"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPopoverOpen(false);
                    setNameInput("");
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || nameInput.trim().length === 0}
                  className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg
                        className="w-3 h-3 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
