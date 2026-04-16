"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useToast } from "./Toast";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebSocketContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NoteAuthor {
  id: string;
  name: string;
  email: string;
}

interface Note {
  id: string;
  body: string;
  author: NoteAuthor;
  createdAt: string;
  updatedAt: string;
}

interface InternalNotesProps {
  channel: string;
  externalId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string (e.g. "2 min ago", "just now").
 */
function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns the first letter of the first word in a name string, uppercased.
 */
function authorInitial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

// ─── Sub-component: single note card ─────────────────────────────────────────

interface NoteCardProps {
  note: Note;
  currentUserId: string | undefined;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

function NoteCard({ note, currentUserId, onEdit, onDelete }: NoteCardProps) {
  const isOwn = currentUserId === note.author.id;

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-3 mb-2">
      <div className="flex items-start gap-2">
        {/* Author avatar */}
        <div className="w-7 h-7 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
          {authorInitial(note.author.name)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-xs font-semibold text-gray-800 truncate">
              {note.author.name}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {relativeTime(note.updatedAt !== note.createdAt ? note.updatedAt : note.createdAt)}
            </span>
          </div>

          {/* Body */}
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
            {note.body}
          </p>

          {/* Own-note actions */}
          {isOwn && (
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => onEdit(note)}
                className="text-xs text-amber-600 hover:text-amber-800 transition font-medium"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(note.id)}
                className="text-xs text-red-400 hover:text-red-600 transition"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: inline edit card ─────────────────────────────────────────

interface EditCardProps {
  note: Note;
  onSave: (noteId: string, body: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function EditCard({ note, onSave, onCancel, saving }: EditCardProps) {
  const [value, setValue] = useState(note.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    // Place cursor at end
    const len = value.length;
    textareaRef.current?.setSelectionRange(len, len);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) onSave(note.id, value.trim());
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <div className="bg-white border border-amber-300 rounded-xl p-3 mb-2">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
          {authorInitial(note.author.name)}
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 leading-relaxed"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-400">⌘↵ to save · Esc to cancel</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { if (value.trim()) onSave(note.id, value.trim()); }}
                disabled={saving || !value.trim()}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {saving && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InternalNotes({ channel, externalId }: InternalNotesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { on, off } = useWebSocket();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // "Add note" textarea state
  const [newBody, setNewBody] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Edit state: which note is being edited
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setError(false);
    try {
      const res = await axios.get(
        `${API}/api/meta/${encodeURIComponent(channel)}/${encodeURIComponent(externalId)}/notes`
      );
      const data: Note[] = Array.isArray(res.data) ? res.data : (res.data.notes ?? []);
      // Sort newest first
      data.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotes(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [channel, externalId]);

  useEffect(() => {
    setLoading(true);
    fetchNotes();
  }, [fetchNotes]);

  // ── WebSocket: re-fetch on note:updated ──────────────────────────────────

  useEffect(() => {
    function handleNoteUpdated(payload: { externalId?: string; channel?: string }) {
      // Only re-fetch when the event matches our conversation
      if (
        payload.externalId === externalId &&
        (!payload.channel || payload.channel === channel)
      ) {
        fetchNotes();
      }
    }

    on("note:updated", handleNoteUpdated);
    return () => {
      off("note:updated", handleNoteUpdated);
    };
  }, [on, off, channel, externalId, fetchNotes]);

  // ── Auto-resize new-note textarea ────────────────────────────────────────

  function handleNewBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function setValue(val: string) {
    setNewBody(val);
  }

  // ── Add note ─────────────────────────────────────────────────────────────

  async function handleAddNote() {
    const body = newBody.trim();
    if (!body || addingSaving) return;
    setAddingSaving(true);
    try {
      await axios.post(
        `${API}/api/meta/${encodeURIComponent(channel)}/${encodeURIComponent(externalId)}/notes`,
        { body }
      );
      setNewBody("");
      if (newTextareaRef.current) {
        newTextareaRef.current.style.height = "auto";
      }
      await fetchNotes();
      toast("Note added");
    } catch {
      toast("Failed to add note", "error");
    } finally {
      setAddingSaving(false);
    }
  }

  function handleNewKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleAddNote();
    }
  }

  // ── Edit note ─────────────────────────────────────────────────────────────

  function handleStartEdit(note: Note) {
    setEditingNoteId(note.id);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
  }

  async function handleSaveEdit(noteId: string, body: string) {
    setEditSaving(true);
    try {
      await axios.patch(
        `${API}/api/meta/${encodeURIComponent(channel)}/${encodeURIComponent(externalId)}/notes/${encodeURIComponent(noteId)}`,
        { body }
      );
      setEditingNoteId(null);
      await fetchNotes();
      toast("Note updated");
    } catch {
      toast("Failed to update note", "error");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete note ───────────────────────────────────────────────────────────

  async function handleDelete(noteId: string) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    try {
      await axios.delete(
        `${API}/api/meta/${encodeURIComponent(channel)}/${encodeURIComponent(externalId)}/notes/${encodeURIComponent(noteId)}`
      );
      await fetchNotes();
      toast("Note deleted");
    } catch {
      toast("Failed to delete note", "error");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-amber-50 rounded-xl p-3">
      {/* Section header */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">🔒</span>
        <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
          Internal Notes
        </h3>
        {notes.length > 0 && (
          <span className="ml-auto text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">
            {notes.length}
          </span>
        )}
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-2 mb-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white border border-amber-200 rounded-xl p-3 animate-pulse">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-amber-100 rounded w-1/3" />
                  <div className="h-2.5 bg-amber-100 rounded w-full" />
                  <div className="h-2.5 bg-amber-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border border-amber-200 rounded-xl p-3 mb-3 text-center">
          <p className="text-xs text-amber-700">Could not load notes.</p>
          <button
            type="button"
            onClick={fetchNotes}
            className="text-xs text-amber-600 hover:text-amber-800 underline mt-1"
          >
            Retry
          </button>
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-amber-500 text-center py-2 mb-2 italic">
          No internal notes yet.
        </p>
      ) : (
        <div className="mb-2">
          {notes.map(note =>
            editingNoteId === note.id ? (
              <EditCard
                key={note.id}
                note={note}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                saving={editSaving}
              />
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                currentUserId={user?.id}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
              />
            )
          )}
        </div>
      )}

      {/* Add note textarea */}
      <div className="relative">
        <textarea
          ref={newTextareaRef}
          value={newBody}
          onChange={handleNewBodyChange}
          onKeyDown={handleNewKeyDown}
          placeholder="Add an internal note… (⌘↵ to save)"
          rows={2}
          className="w-full bg-white border border-amber-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder-amber-300 leading-relaxed"
          style={{ minHeight: "60px" }}
        />
        {/* Send button — visible only when there is text */}
        {newBody.trim() && (
          <div className="flex items-center justify-end mt-1.5 gap-2">
            <span className="text-xs text-amber-400">⌘↵ to save</span>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={addingSaving}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium"
            >
              {addingSaving && (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              )}
              Add note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
