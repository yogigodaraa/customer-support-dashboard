"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ConversationTag extends Tag {
  addedAt: string;
}

interface TagPickerProps {
  channel: string;
  externalId: string;
  onChanged?: () => void;
}

export default function TagPicker({ channel, externalId, onChanged }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [conversationTags, setConversationTags] = useState<ConversationTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchConversationTags = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/meta/${channel}/${externalId}`);
      const tags = res.data?.tags ?? [];
      setConversationTags(Array.isArray(tags) ? tags : []);
    } catch {
      // silently ignore; conversation may not have tags yet
    }
  }, [channel, externalId]);

  const fetchAllTags = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/tags`);
      const list = res.data;
      setAllTags(Array.isArray(list) ? list : []);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    setLoadingTags(true);
    Promise.all([fetchAllTags(), fetchConversationTags()]).finally(() =>
      setLoadingTags(false)
    );
  }, [fetchAllTags, fetchConversationTags]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && !showCreate) {
      setTimeout(() => searchRef.current?.focus(), 30);
    }
    if (open && showCreate) {
      setTimeout(() => createInputRef.current?.focus(), 30);
    }
  }, [open, showCreate]);

  // Dismiss on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
        setSearch("");
        setNewTagName("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function removeTag(tagId: string) {
    if (removingId) return;
    setRemovingId(tagId);
    try {
      await axios.delete(`${API}/api/meta/${channel}/${externalId}/tags/${tagId}`);
      await fetchConversationTags();
      onChanged?.();
      toast("Tag removed");
    } catch {
      toast("Failed to remove tag", "error");
    } finally {
      setRemovingId(null);
    }
  }

  async function addTag(tagId: string) {
    if (addingId) return;
    setAddingId(tagId);
    try {
      await axios.post(`${API}/api/meta/${channel}/${externalId}/tags`, { tagId });
      await fetchConversationTags();
      onChanged?.();
      toast("Tag added");
    } catch {
      toast("Failed to add tag", "error");
    } finally {
      setAddingId(null);
    }
  }

  async function createAndApplyTag() {
    const name = newTagName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await axios.post(`${API}/api/tags`, { name, color: "#6B7280" });
      const createdTag: Tag = res.data;
      setAllTags(prev => [...prev, createdTag]);
      await axios.post(`${API}/api/meta/${channel}/${externalId}/tags`, { tagId: createdTag.id });
      await fetchConversationTags();
      onChanged?.();
      toast(`Tag "${name}" created and applied`);
      setNewTagName("");
      setShowCreate(false);
      setSearch("");
    } catch {
      toast("Failed to create tag", "error");
    } finally {
      setCreating(false);
    }
  }

  const appliedIds = new Set(conversationTags.map(t => t.id));
  const filteredAvailable = allTags.filter(
    t =>
      !appliedIds.has(t.id) &&
      (!search || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="relative flex flex-wrap items-center gap-1.5" ref={dropdownRef}>
      {/* Loading skeleton */}
      {loadingTags && (
        <span className="text-xs text-gray-400 animate-pulse">Loading tags…</span>
      )}

      {/* Current tag chips */}
      {!loadingTags &&
        conversationTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: tag.color + "22",
              borderColor: tag.color,
              color: tag.color,
            }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              disabled={removingId === tag.id}
              className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-black/10 transition disabled:opacity-40"
              title="Remove tag"
              aria-label={`Remove tag ${tag.name}`}
            >
              {removingId === tag.id ? (
                <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <svg
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="w-2.5 h-2.5"
                >
                  <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </span>
        ))}

      {/* Add tag button */}
      {!loadingTags && (
        <button
          type="button"
          onClick={() => {
            setOpen(v => !v);
            setShowCreate(false);
            setSearch("");
            setNewTagName("");
          }}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 hover:border-gray-400 rounded-full px-2 py-0.5 transition"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="w-3 h-3"
          >
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Add tag
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-48 top-full mt-1.5 left-0">
          {!showCreate ? (
            <>
              {/* Search input */}
              <input
                ref={searchRef}
                type="text"
                placeholder="Search tags…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setSearch("");
                  }
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 mb-1.5"
              />

              {/* Available tags list */}
              <div className="max-h-48 overflow-y-auto">
                {filteredAvailable.length === 0 && !search && (
                  <p className="px-2 py-2 text-xs text-gray-400 text-center">
                    All tags already applied
                  </p>
                )}
                {filteredAvailable.length === 0 && search && (
                  <p className="px-2 py-2 text-xs text-gray-400 text-center">
                    No tags match &ldquo;{search}&rdquo;
                  </p>
                )}
                {filteredAvailable.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => addTag(tag.id)}
                    disabled={addingId === tag.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-left"
                  >
                    {addingId === tag.id ? (
                      <span
                        className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block flex-shrink-0"
                      />
                    ) : (
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    <span className="text-xs text-gray-700">{tag.name}</span>
                  </button>
                ))}
              </div>

              {/* Create new option */}
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setNewTagName(search);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition border-t border-gray-100 pt-2"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="w-3 h-3"
                >
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
                Create new tag
              </button>
            </>
          ) : (
            /* Create new tag inline form */
            <>
              <p className="text-xs font-semibold text-gray-600 mb-2 px-1">New tag name</p>
              <input
                ref={createInputRef}
                type="text"
                placeholder="e.g. billing-issue"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") createAndApplyTag();
                  if (e.key === "Escape") {
                    setShowCreate(false);
                    setNewTagName("");
                  }
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setNewTagName("");
                  }}
                  className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-1 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createAndApplyTag}
                  disabled={!newTagName.trim() || creating}
                  className="flex-1 text-xs bg-gray-900 text-white py-1 rounded-lg hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  {creating && (
                    <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  )}
                  Create &amp; apply
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
