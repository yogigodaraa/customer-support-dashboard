"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Tag {
  id: string;
  name: string;
  color: string;
}

type SnoozeOption = {
  label: string;
  until: () => Date;
};

const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: "1 hour",    until: () => new Date(Date.now() + 1 * 60 * 60 * 1000) },
  { label: "4 hours",   until: () => new Date(Date.now() + 4 * 60 * 60 * 1000) },
  { label: "Tomorrow",  until: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: "Next week", until: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; } },
];

type ActivePanel = "assign" | "tag" | "snooze" | null;

export interface BulkActionBarProps {
  selectedIds: string[];
  channel: string;
  gmailInbox?: "support" | "kyc";
  onClear: () => void;
  onDone: () => void;
}

export default function BulkActionBar({
  selectedIds,
  channel,
  gmailInbox,
  onClear,
  onDone,
}: BulkActionBarProps) {
  const { toast } = useToast();

  // Action loading states
  const [archiving, setArchiving]   = useState(false);
  const [assigning, setAssigning]   = useState(false);
  const [tagging, setTagging]       = useState(false);
  const [snoozing, setSnoozing]     = useState(false);

  // Panel state
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Assign panel state
  const [assigneeEmail, setAssigneeEmail] = useState("");

  // Tag panel state
  const [tags, setTags]             = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsError, setTagsError]   = useState(false);

  // Snooze panel state — no extra state needed, uses SNOOZE_OPTIONS

  // Refs for outside-click dismissal
  const barRef = useRef<HTMLDivElement>(null);

  const showArchive = channel === "intercom" || channel === "gmail";
  const count = selectedIds.length;

  // Close panels on outside click
  useEffect(() => {
    if (!activePanel) return;
    function handleOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActivePanel(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [activePanel]);

  // Reset panel and email when selection is cleared
  useEffect(() => {
    if (count === 0) {
      setActivePanel(null);
      setAssigneeEmail("");
    }
  }, [count]);

  // Fetch tags when tag panel is opened
  const fetchTags = useCallback(async () => {
    setTagsLoading(true);
    setTagsError(false);
    try {
      const res = await axios.get<Tag[]>(`${API}/api/tags`);
      setTags(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTagsError(true);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  function togglePanel(panel: ActivePanel) {
    if (activePanel === panel) {
      setActivePanel(null);
      return;
    }
    setActivePanel(panel);
    if (panel === "tag") {
      fetchTags();
    }
  }

  // ------------------------------------------------------------------ actions
  async function handleArchive() {
    if (archiving) return;
    setArchiving(true);
    try {
      await axios.post(`${API}/api/bulk/archive`, {
        channel,
        ids: selectedIds,
        ...(channel === "gmail" && gmailInbox ? { gmailInbox } : {}),
      });
      toast(`${count} conversation${count !== 1 ? "s" : ""} archived`);
      onDone();
      onClear();
    } catch {
      toast("Failed to archive conversations", "error");
    } finally {
      setArchiving(false);
    }
  }

  async function handleAssign() {
    const email = assigneeEmail.trim();
    if (!email || assigning) return;
    setAssigning(true);
    try {
      await axios.post(`${API}/api/bulk/assign`, {
        channel,
        ids: selectedIds,
        assigneeEmail: email,
      });
      toast(`${count} conversation${count !== 1 ? "s" : ""} assigned to ${email}`);
      setAssigneeEmail("");
      setActivePanel(null);
      onDone();
      onClear();
    } catch {
      toast("Failed to assign conversations", "error");
    } finally {
      setAssigning(false);
    }
  }

  async function handleTag(tagId: string) {
    if (tagging) return;
    setTagging(true);
    try {
      await axios.post(`${API}/api/bulk/tag`, {
        channel,
        ids: selectedIds,
        tagId,
      });
      toast(`Tag applied to ${count} conversation${count !== 1 ? "s" : ""}`);
      setActivePanel(null);
      onDone();
      onClear();
    } catch {
      toast("Failed to apply tag", "error");
    } finally {
      setTagging(false);
    }
  }

  async function handleSnooze(option: SnoozeOption) {
    if (snoozing) return;
    setSnoozing(true);
    try {
      await axios.post(`${API}/api/bulk/snooze`, {
        channel,
        ids: selectedIds,
        until: option.until().toISOString(),
      });
      toast(`${count} conversation${count !== 1 ? "s" : ""} snoozed until ${option.label.toLowerCase()}`);
      setActivePanel(null);
      onDone();
      onClear();
    } catch {
      toast("Failed to snooze conversations", "error");
    } finally {
      setSnoozing(false);
    }
  }

  // ------------------------------------------------------------------ render
  if (count === 0) return null;

  return (
    <div
      ref={barRef}
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-gray-900 text-white px-6 py-3 shadow-2xl"
      style={{
        transform: "translateY(0)",
        transition: "transform 0.2s ease-out",
        animation: "bulk-slide-up 0.2s ease-out",
      }}
    >
      {/* Left: selection count + clear */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-medium">
          {count} conversation{count !== 1 ? "s" : ""} selected
        </span>
        <button
          type="button"
          onClick={() => {
            setActivePanel(null);
            onClear();
          }}
          className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <svg
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-2.5 h-2.5"
          >
            <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Right: action buttons + inline panels */}
      <div className="flex items-center gap-2 flex-wrap relative">
        {/* Archive */}
        {showArchive && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {archiving && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            )}
            Archive
          </button>
        )}

        {/* Assign */}
        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("assign")}
            disabled={assigning}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 ${
              activePanel === "assign" ? "ring-2 ring-blue-300" : ""
            }`}
          >
            {assigning && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            )}
            Assign
          </button>

          {/* Assign inline panel */}
          {activePanel === "assign" && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-900 rounded-xl shadow-2xl p-4 border border-gray-200 min-w-64 z-50">
              <p className="text-xs font-semibold text-gray-600 mb-2">Assign to</p>
              <input
                type="email"
                placeholder="agent@example.com"
                value={assigneeEmail}
                autoFocus
                onChange={e => setAssigneeEmail(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAssign();
                  if (e.key === "Escape") setActivePanel(null);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  className="flex-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={!assigneeEmail.trim() || assigning}
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  {assigning && (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  )}
                  Assign
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tag */}
        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("tag")}
            disabled={tagging}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 ${
              activePanel === "tag" ? "ring-2 ring-purple-300" : ""
            }`}
          >
            {tagging && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            )}
            Tag
          </button>

          {/* Tag inline panel */}
          {activePanel === "tag" && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-900 rounded-xl shadow-2xl p-3 border border-gray-200 min-w-48 z-50">
              <p className="text-xs font-semibold text-gray-600 mb-2 px-1">Apply tag</p>
              {tagsLoading && (
                <p className="text-xs text-gray-400 text-center py-3 animate-pulse">
                  Loading tags…
                </p>
              )}
              {tagsError && !tagsLoading && (
                <div className="text-center py-3">
                  <p className="text-xs text-red-500 mb-2">Failed to load tags</p>
                  <button
                    type="button"
                    onClick={fetchTags}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!tagsLoading && !tagsError && tags.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No tags available</p>
              )}
              {!tagsLoading && !tagsError && tags.length > 0 && (
                <div className="max-h-48 overflow-y-auto">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTag(tag.id)}
                      disabled={tagging}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-left"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-xs text-gray-700">{tag.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Snooze */}
        <div className="relative">
          <button
            type="button"
            onClick={() => togglePanel("snooze")}
            disabled={snoozing}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition bg-yellow-500 hover:bg-yellow-600 text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 ${
              activePanel === "snooze" ? "ring-2 ring-yellow-300" : ""
            }`}
          >
            {snoozing && (
              <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin inline-block" />
            )}
            Snooze
          </button>

          {/* Snooze inline panel */}
          {activePanel === "snooze" && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-900 rounded-xl shadow-2xl p-3 border border-gray-200 min-w-40 z-50">
              <p className="text-xs font-semibold text-gray-600 mb-2 px-1">Snooze until</p>
              {SNOOZE_OPTIONS.map(option => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleSnooze(option)}
                  disabled={snoozing}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition disabled:opacity-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide-up keyframe (injected inline so no Tailwind config needed) */}
      <style>{`
        @keyframes bulk-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
