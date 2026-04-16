"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import ReplyComposer from "@/components/ReplyComposer";
import CustomerPanel from "@/components/CustomerPanel";
import { useToast } from "@/components/Toast";
import { useAiChat } from "@/components/AiChatContext";
import { useCanWrite } from "@/components/RoleGate";
import { useWebSocket } from "@/components/WebSocketContext";
import CollisionBanner from "@/components/CollisionBanner";
import TagPicker from "@/components/TagPicker";
import SnoozeButton from "@/components/SnoozeButton";
import SlaIndicator from "@/components/SlaIndicator";
import InternalNotes from "@/components/InternalNotes";
import BulkActionBar from "@/components/BulkActionBar";
import FileViewer, { FileItem } from "@/components/FileViewer";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type TabKey = "all" | "inbox" | "spam" | "trash" | "drafts" | "archived" | "snoozed";

interface Conversation {
  id: string;
  subject: string;
  status: string;
  assignee: null;
  recipient: { name: string; email: string };
  last_message_at: string;
  last_message_preview: string;
  is_read: boolean;
  tags: string[];
  inbox: string;
  time_ago: string;
  isDraft?: boolean;
}

interface MessageAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  messageId: string;
}

interface Message {
  id: string;
  from: { name: string; email: string };
  body: string;
  htmlBody?: string | null;
  attachments?: MessageAttachment[];
  created_at: string;
  is_inbound: boolean;
}

interface ConversationDetail extends Conversation {
  messages: Message[];
}

interface Counts { all: number; inbox: number; archived: number; spam: number; trash: number; drafts: number }

/** Sanitise HTML for safe rendering — strips scripts, event handlers, javascript: hrefs. */
function sanitizeHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/<(meta|link|iframe|object|embed|base)[^>]*>/gi, "");
}

/** Convert plain-text email body — angle-bracket URLs → clickable links. */
function plaintextToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/&lt;(https?:\/\/[^\s&>]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all">$1</a>')
    .replace(/(^|[\s(])((https?:\/\/)[^\s)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all">$2</a>')
    .replace(/\n/g, "<br>");
}

function initials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ─── Compose Modal ──────────────────────────────────────────────────────────────

interface ComposeProps {
  draftId?: string | null;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  onClose: () => void;
  onSent: () => void;
}

function ComposeToolbarBtn({ icon, title, active, onClick }: { icon: React.ReactNode; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition ${
        active ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      }`}
    >{icon}</button>
  );
}

interface TemplateItem { id: string; title: string; body: string; category: string }

function ComposeModal({ draftId, initialTo, initialSubject, initialBody, onClose, onSent }: ComposeProps) {
  const channel = "support";
  const [to, setTo] = useState(initialTo || "");
  const [subject, setSubject] = useState(initialSubject || "");
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const { toast } = useToast();
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);

  // Template state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const templateSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bodyRef.current && initialBody) {
      bodyRef.current.innerText = initialBody;
    }
    setTimeout(() => bodyRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (showTemplates) setTimeout(() => templateSearchRef.current?.focus(), 30);
  }, [showTemplates]);

  // Save selection on any selection change inside the editor
  useEffect(() => {
    function onSelChange() {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && bodyRef.current?.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    }
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  function getBodyText() { return bodyRef.current?.innerText?.trim() || ""; }

  function restoreSelection() {
    const editor = bodyRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function exec(cmd: string, val?: string) {
    restoreSelection();
    document.execCommand(cmd, false, val);
  }

  // Template helpers
  async function loadTemplates() {
    if (templatesLoaded) return;
    try {
      const res = await axios.get(`${API}/api/templates`);
      const list = res.data.templates ?? res.data;
      setTemplates(Array.isArray(list) ? list : []);
      setTemplatesLoaded(true);
    } catch { /* templates are optional */ }
  }

  function openTemplatePicker() {
    setShowTemplates(true);
    setTemplateSearch("");
    loadTemplates();
  }

  function resolveTemplatePlaceholders(text: string): string {
    const name = to.split("@")[0] || "there";
    return text
      .replace(/\{\{customer_name\}\}/gi, name)
      .replace(/\{\{first_name\}\}/gi, name)
      .replace(/\{\{agent_name\}\}/gi, "WeMoney Support")
      .replace(/\{\{end_date\}\}/gi, new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }));
  }

  function insertTemplate(tpl: TemplateItem) {
    if (bodyRef.current) {
      bodyRef.current.innerText = resolveTemplatePlaceholders(tpl.body);
    }
    setShowTemplates(false);
    bodyRef.current?.focus();
  }

  const filteredTemplates = templates.filter(t =>
    !templateSearch ||
    t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(templateSearch.toLowerCase())
  );

  async function handleSend() {
    const body = getBodyText();
    if (!to.trim() || !subject.trim() || !body) {
      toast("Please fill in all fields", "error");
      return;
    }
    setSending(true);
    try {
      if (draftId) {
        await axios.post(`${API}/api/gmail/drafts/${draftId}/send`, { channel });
      } else {
        await axios.post(`${API}/api/gmail/compose`, { to: to.trim(), subject: subject.trim(), body, channel });
      }
      toast("Email sent");
      onSent();
      onClose();
    } catch {
      toast("Failed to send email", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    const body = getBodyText();
    setSavingDraft(true);
    try {
      if (draftId) {
        await axios.put(`${API}/api/gmail/drafts/${draftId}`, { to, subject, body, channel });
        toast("Draft updated");
      } else {
        await axios.post(`${API}/api/gmail/drafts`, { to, subject, body, channel });
        toast("Draft saved");
      }
      onSent();
      onClose();
    } catch {
      toast("Failed to save draft", "error");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDeleteDraft() {
    if (!draftId) { onClose(); return; }
    try {
      await axios.delete(`${API}/api/gmail/drafts/${draftId}`, { params: { channel } });
      toast("Draft deleted");
      onSent();
      onClose();
    } catch {
      toast("Failed to delete draft", "error");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSend(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); exec("bold"); }
    if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); exec("italic"); }
    if ((e.metaKey || e.ctrlKey) && e.key === "u") { e.preventDefault(); exec("underline"); }
    if (e.key === "/" && getBodyText() === "") { e.preventDefault(); openTemplatePicker(); }
    if (e.key === "Escape") setShowTemplates(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{draftId ? "Edit Draft" : "New Email"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        {/* Fields */}
        <div className="px-5 py-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-14 flex-shrink-0">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-14 flex-shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="flex-1 text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 px-5 pb-1.5 flex-wrap">
          <ComposeToolbarBtn icon={<span className="font-bold text-[11px]">B</span>} title="Bold (⌘B)" onClick={() => exec("bold")} />
          <ComposeToolbarBtn icon={<span className="italic text-[11px]">I</span>} title="Italic (⌘I)" onClick={() => exec("italic")} />
          <ComposeToolbarBtn icon={<span className="underline text-[11px]">U</span>} title="Underline (⌘U)" onClick={() => exec("underline")} />
          <ComposeToolbarBtn icon={<span className="line-through text-[11px]">S</span>} title="Strikethrough" onClick={() => exec("strikeThrough")} />
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          <ComposeToolbarBtn
            icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
            title="Bullet list"
            onClick={() => exec("insertUnorderedList")}
          />
          <ComposeToolbarBtn
            icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>}
            title="Numbered list"
            onClick={() => exec("insertOrderedList")}
          />
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          <ComposeToolbarBtn
            icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
            title="Insert link"
            onClick={() => {
              const url = prompt("Enter URL:");
              if (url) exec("createLink", url);
            }}
          />
          <ComposeToolbarBtn
            icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>}
            title="Attach file"
            onClick={() => fileRef.current?.click()}
          />
          <ComposeToolbarBtn
            icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
            title="Code"
            onClick={() => {
              const sel = window.getSelection();
              if (sel && sel.toString()) {
                exec("insertHTML", `<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:0.85em;font-family:monospace">${sel.toString()}</code>`);
              }
            }}
          />
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          <ComposeToolbarBtn
            icon={<span className="text-[11px]">📋</span>}
            title="Insert template (or type /)"
            onClick={openTemplatePicker}
          />
        </div>

        {/* Body — rich text editor */}
        <div className="px-5 pb-2 flex-1 relative">
          {/* Template picker dropdown */}
          {showTemplates && (
            <div className="absolute top-0 left-5 right-5 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-30">
              <div className="p-2 border-b border-gray-100">
                <input
                  ref={templateSearchRef}
                  type="text"
                  placeholder="Search templates…"
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  onKeyDown={e => e.key === "Escape" && setShowTemplates(false)}
                  className="w-full px-3 py-1.5 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredTemplates.length === 0 ? (
                  <p className="p-3 text-sm text-gray-400 text-center">
                    {templatesLoaded ? "No templates found" : "Loading…"}
                  </p>
                ) : filteredTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => insertTemplate(t)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{t.category}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{resolveTemplatePlaceholders(t.body).slice(0, 90)}{t.body.length > 90 ? "…" : ""}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 transition"
              >
                Press Esc to close
              </button>
            </div>
          )}

          <div
            ref={bodyRef}
            contentEditable
            onKeyDown={handleKeyDown}
            data-placeholder="Write your email… (type / for templates)"
            className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
            style={{ minHeight: "180px", maxHeight: "300px", overflowY: "auto" }}
          />
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {attachments.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 pl-2 pr-1 py-0.5 rounded-md border border-blue-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span className="max-w-[100px] truncate">{f.name}</span>
                <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="text-blue-400 hover:text-blue-700 ml-0.5">&times;</button>
              </span>
            ))}
          </div>
        )}

        <input ref={fileRef} type="file" multiple onChange={e => { setAttachments(p => [...p, ...Array.from(e.target.files || [])]); e.target.value = ""; }} className="hidden" />

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleDeleteDraft}
            className="text-xs text-gray-400 hover:text-red-500 transition"
          >
            {draftId ? "Delete Draft" : "Discard"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="text-xs px-3.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {savingDraft && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
              {draftId ? "Update Draft" : "Save Draft"}
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {sending && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Send
              <span className="text-blue-300 text-[10px]">&#8984;&#9166;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function GmailPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, inbox: 0, archived: 0, spam: 0, trash: 0, drafts: 0 });
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const activeChannel = "support";
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<{ id: string; to: string; subject: string; body: string } | null>(null);
  const [viewingFile, setViewingFile] = useState<FileItem | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { injectContext, insertMessage, isOpen: aiOpen } = useAiChat();
  const canWrite = useCanWrite();

  // ── Phase 2 state ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [detailTab, setDetailTab] = useState<"messages" | "notes">("messages");
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);

  const { subscribe, unsubscribe, on, off, emit } = useWebSocket();

  // ── WebSocket subscription ───────────────────────────────────────────────────
  useEffect(() => {
    subscribe("gmail");
    return () => { unsubscribe("gmail"); };
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    function handleGmailUpdated() { fetchList(); }
    function handleConversationSnoozed(data: { id?: string; externalId?: string }) {
      const id = data?.id ?? data?.externalId;
      if (id) setSnoozedIds(prev => { const next = new Set(prev); next.add(id); return next; });
    }
    function handleConversationUnsnoozed(data: { id?: string; externalId?: string }) {
      const id = data?.id ?? data?.externalId;
      if (id) setSnoozedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }

    on("gmail:updated", handleGmailUpdated);
    on("conversation:snoozed", handleConversationSnoozed);
    on("conversation:unsnoozed", handleConversationUnsnoozed);

    return () => {
      off("gmail:updated", handleGmailUpdated);
      off("conversation:snoozed", handleConversationSnoozed);
      off("conversation:unsnoozed", handleConversationUnsnoozed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, off]);

  // ── Presence: emit when selected conversation changes ────────────────────────
  useEffect(() => {
    if (!selected) return;
    emit("presence:viewing", { channel: "gmail", externalId: selected.id });
    return () => {
      emit("presence:left", { channel: "gmail", externalId: selected.id });
    };
  }, [selected?.id, emit]);

  // ── Fetch snoozedUntil for the selected conversation ────────────────────────
  useEffect(() => {
    if (!selected) { setSnoozedUntil(null); return; }
    setSnoozedUntil(null);
    axios
      .get(`${API}/api/meta/gmail/${selected.id}`)
      .then(res => { setSnoozedUntil(res.data?.snoozedUntil ?? null); })
      .catch(() => { setSnoozedUntil(null); });
  }, [selected?.id]);

  // ── Reset detailTab when conversation changes ────────────────────────────────
  useEffect(() => {
    setDetailTab("messages");
  }, [selected?.id]);

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { channel: activeChannel };
      if (activeTab !== "all" && activeTab !== "snoozed") params.status = activeTab;
      if (search) params.q = search;
      const res = await axios.get(`${API}/api/gmail/threads`, { params });
      setConversations(res.data.conversations);
      setCounts(res.data.counts);
    } catch { /* silently ignore */ }
    finally { setIsLoading(false); }
  }, [activeChannel, activeTab, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Auto-poll conversation list every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchList, 300000);
    return () => clearInterval(interval);
  }, [fetchList]);

  useEffect(() => {
    if (selected) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [selected?.id, selected?.messages?.length]);

  // Poll selected conversation every 60s — refresh list immediately if new messages detected
  useEffect(() => {
    if (!selected) return;
    const threadId = selected.id;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/gmail/threads/${threadId}`, { params: { channel: activeChannel } });
        const detail = res.data as ConversationDetail;
        setSelected(prev => {
          if (!prev || prev.id !== threadId) return prev;
          if (detail.messages.length > prev.messages.length) {
            fetchList(); // new message arrived — refresh the list too
            return detail;
          }
          return prev;
        });
      } catch { /* ignore */ }
    }, 60000);
    return () => clearInterval(interval);
  }, [selected?.id, activeChannel, fetchList]);

  async function openConversation(c: Conversation) {
    // Drafts open in compose modal instead of detail view
    if (c.isDraft) {
      try {
        const res = await axios.get(`${API}/api/gmail/drafts/${c.id}`, { params: { channel: activeChannel } });
        setEditingDraft({ id: res.data.id, to: res.data.to, subject: res.data.subject, body: res.data.body });
      } catch {
        toast("Could not load draft", "error");
      }
      return;
    }

    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/api/gmail/threads/${c.id}`, { params: { channel: activeChannel } });
      const detail = res.data as ConversationDetail;
      setSelected(detail);
      injectContext({
        source: "gmail",
        conversationId: detail.id,
        subject: detail.subject,
        contactName: detail.recipient.name,
        contactEmail: detail.recipient.email,
        messages: detail.messages.map(m => ({
          from: m.from.name,
          body: m.body,
          isInbound: m.is_inbound,
          createdAt: m.created_at,
        })),
      });
    } catch { toast("Could not load conversation", "error"); }
    finally { setDetailLoading(false); }
  }

  async function refreshConversation() {
    if (!selected) return;
    const prevCount = selected.messages.length;

    // First attempt after a short delay (Gmail needs time to process)
    await new Promise(r => setTimeout(r, 1500));
    try {
      const res = await axios.get(`${API}/api/gmail/threads/${selected.id}`, { params: { channel: activeChannel } });
      const detail = res.data as ConversationDetail;
      setSelected(detail);

      // If message count didn't change, retry once more after a longer delay
      if (detail.messages.length <= prevCount) {
        await new Promise(r => setTimeout(r, 3000));
        const res2 = await axios.get(`${API}/api/gmail/threads/${selected.id}`, { params: { channel: activeChannel } });
        setSelected(res2.data as ConversationDetail);
      }
    } catch { /* silently ignore */ }
    fetchList();
  }

  async function archiveConversation() {
    if (!selected || actionLoading) return;
    setActionLoading("archive");
    try {
      await axios.patch(`${API}/api/gmail/threads/${selected.id}/archive`, { channel: activeChannel });
      setSelected(prev => prev ? { ...prev, status: "archived" } : prev);
      setConversations(prev => prev.filter(c => c.id !== selected.id));
      toast("Conversation archived");
      fetchList();
    } catch {
      toast("Failed to archive", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function trashConversation() {
    if (!selected || actionLoading) return;
    setActionLoading("trash");
    try {
      await axios.patch(`${API}/api/gmail/threads/${selected.id}/trash`, { channel: activeChannel });
      setConversations(prev => prev.filter(c => c.id !== selected.id));
      setSelected(null);
      toast("Moved to trash");
      fetchList();
    } catch {
      toast("Failed to move to trash", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function untrashConversation() {
    if (!selected || actionLoading) return;
    setActionLoading("untrash");
    try {
      await axios.patch(`${API}/api/gmail/threads/${selected.id}/untrash`, { channel: activeChannel });
      setConversations(prev => prev.filter(c => c.id !== selected.id));
      setSelected(null);
      toast("Restored from trash");
      fetchList();
    } catch {
      toast("Failed to restore", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function spamConversation() {
    if (!selected || actionLoading) return;
    setActionLoading("spam");
    try {
      await axios.patch(`${API}/api/gmail/threads/${selected.id}/spam`, { channel: activeChannel });
      setConversations(prev => prev.filter(c => c.id !== selected.id));
      setSelected(null);
      toast("Marked as spam");
      fetchList();
    } catch {
      toast("Failed to mark as spam", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function unspamConversation() {
    if (!selected || actionLoading) return;
    setActionLoading("unspam");
    try {
      await axios.patch(`${API}/api/gmail/threads/${selected.id}/unspam`, { channel: activeChannel });
      setConversations(prev => prev.filter(c => c.id !== selected.id));
      setSelected(null);
      toast("Removed from spam");
      fetchList();
    } catch {
      toast("Failed to remove from spam", "error");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Multi-select helpers ─────────────────────────────────────────────────────
  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // ── Snoozed tab filter ───────────────────────────────────────────────────────
  const displayedConversations = activeTab === "snoozed"
    ? conversations.filter(c => snoozedIds.has(c.id))
    : conversations;

  const TABS: Array<{ key: TabKey; label: string; icon?: string }> = [
    { key: "all",        label: "All" },
    { key: "inbox",      label: "Inbox",      icon: "📥" },
    { key: "snoozed",    label: "Snoozed",    icon: "😴" },
    { key: "spam",       label: "Spam",       icon: "⚠️" },
    { key: "trash",      label: "Deleted",    icon: "🗑️" },
    { key: "drafts",     label: "Drafts",     icon: "📝" },
    { key: "archived",   label: "Archived",   icon: "📦" },
  ];

  function tabCount(key: TabKey): number {
    if (key === "snoozed") return snoozedIds.size;
    return counts[key as keyof Counts] ?? 0;
  }

  // Determine context action buttons for the detail header
  function renderActions() {
    if (!selected || !canWrite) return null;
    const btns: Array<{ label: string; key: string; onClick: () => void; danger?: boolean }> = [];

    if (activeTab === "spam") {
      btns.push({ label: "Not Spam", key: "unspam", onClick: unspamConversation });
    } else if (activeTab === "trash") {
      btns.push({ label: "Restore", key: "untrash", onClick: untrashConversation });
    } else {
      if (activeTab !== "archived") {
        btns.push({ label: "Archive", key: "archive", onClick: archiveConversation });
      }
      btns.push({ label: "Spam", key: "spam", onClick: spamConversation, danger: true });
      btns.push({ label: "Delete", key: "trash", onClick: trashConversation, danger: true });
    }

    return (
      <div className="flex items-center gap-1.5">
        {btns.map(b => (
          <button
            key={b.key}
            onClick={b.onClick}
            disabled={actionLoading === b.key}
            className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 flex items-center gap-1.5 ${
              b.danger
                ? "border-red-200 text-red-600 hover:bg-red-50"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {actionLoading === b.key && (
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {b.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col" style={{ height: "100vh" }}>

        {/* Top bar */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-lg">📧</div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Support Email</h1>
              <p className="text-xs text-gray-400">Support Gmail inbox</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canWrite && (
              <button
                onClick={() => setComposeOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5"
              >
                <span className="text-sm leading-none">+</span>
                Compose
              </button>
            )}
          </div>
        </div>

        {/* Three-panel body */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: conversation list */}
          <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Search emails…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="flex border-b border-gray-100 px-1 overflow-x-auto scrollbar-thin">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); setSelected(null); setSelectedIds([]); }}
                  className={`flex-shrink-0 px-2 py-2 text-xs font-medium transition whitespace-nowrap ${
                    activeTab === t.key
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.icon && <span className="mr-0.5">{t.icon}</span>}
                  {t.label}
                  {tabCount(t.key) > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                      activeTab === t.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                    }`}>{tabCount(t.key)}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedConversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  {activeTab === "drafts" ? "No drafts" : activeTab === "spam" ? "No spam" : activeTab === "trash" ? "Trash is empty" : activeTab === "snoozed" ? "No snoozed conversations" : "No emails found"}
                </div>
              ) : displayedConversations.map(c => (
                <div
                  key={c.id}
                  className={`group/row relative border-b border-gray-50 transition ${
                    selected?.id === c.id
                      ? "bg-blue-50 border-l-2 border-l-blue-600"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Checkbox — always visible when items are selected, otherwise shows on hover */}
                  <div
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 transition-opacity ${
                      selectedIds.length > 0 ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
                    }`}
                    onClick={e => toggleSelect(c.id, e)}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition ${
                      selectedIds.includes(c.id)
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-300 hover:border-blue-400"
                    }`}>
                      {selectedIds.includes(c.id) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Row button — clicking the row still navigates */}
                  <button
                    onClick={() => openConversation(c)}
                    className={`w-full text-left px-3 py-3 transition ${
                      selectedIds.length > 0 ? "pl-8" : "group-hover/row:pl-8"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                        c.isDraft
                          ? "bg-gradient-to-br from-amber-400 to-amber-600"
                          : "bg-gradient-to-br from-blue-400 to-blue-600"
                      }`}>
                        {c.isDraft ? "📝" : initials(c.recipient.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className={`text-sm truncate ${!c.is_read ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>
                            {c.isDraft ? (c.recipient.email || "Draft") : c.recipient.name}
                          </p>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{c.time_ago}</span>
                        </div>
                        <p className="text-xs text-gray-600 truncate mt-0.5">{c.subject || "(no subject)"}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{c.last_message_preview}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {!c.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                          {snoozedIds.has(c.id) && (
                            <span className="text-[10px] text-yellow-600 bg-yellow-50 px-1 rounded">😴</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* MIDDLE: conversation detail */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            {!selected && !detailLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <div className="text-5xl mb-4">📧</div>
                <p className="text-lg font-semibold text-gray-700">Select an email</p>
                <p className="text-sm text-gray-400 mt-1">Choose a conversation from the list to read the full thread.</p>
              </div>
            )}

            {detailLoading && (
              <div className="p-6 space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
              </div>
            )}

            {selected && !detailLoading && (
              <>
                {/* Header */}
                <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3.5">
                  {/* CollisionBanner at top of detail pane */}
                  <CollisionBanner channel="gmail" externalId={selected.id} />

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-gray-900 truncate">{selected.subject}</h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500">{selected.recipient.name}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{selected.recipient.email}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                          Support
                        </span>
                      </div>
                    </div>
                    {renderActions()}
                  </div>

                  {/* TagPicker + SnoozeButton + SlaIndicator row */}
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <TagPicker channel="gmail" externalId={selected.id} />
                    <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
                    <SnoozeButton
                      channel="gmail"
                      externalId={selected.id}
                      snoozedUntil={snoozedUntil}
                      onChanged={setSnoozedUntil}
                    />
                    <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
                    <SlaIndicator channel="gmail" externalId={selected.id} />
                  </div>

                  {/* Messages | Notes tab switcher */}
                  <div className="flex items-center gap-0 mt-3 border-b border-gray-100 -mb-3.5">
                    <button
                      onClick={() => setDetailTab("messages")}
                      className={`px-4 py-2 text-xs font-medium transition border-b-2 ${
                        detailTab === "messages"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 border-transparent hover:text-gray-700"
                      }`}
                    >
                      Messages
                    </button>
                    <button
                      onClick={() => setDetailTab("notes")}
                      className={`px-4 py-2 text-xs font-medium transition border-b-2 ${
                        detailTab === "notes"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 border-transparent hover:text-gray-700"
                      }`}
                    >
                      Notes
                    </button>
                  </div>
                </div>

                {/* Messages tab */}
                {detailTab === "messages" && (
                  <>
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                      {selected.messages.map(msg => (
                        <div key={msg.id} className={`flex gap-3 ${msg.is_inbound ? "" : "flex-row-reverse"} group/msg`}>
                          <div className={`w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                            msg.is_inbound
                              ? "bg-gradient-to-br from-gray-400 to-gray-600"
                              : "bg-gradient-to-br from-blue-500 to-blue-700"
                          }`}>
                            {initials(msg.from.name)}
                          </div>
                          <div className={`max-w-[60%] flex flex-col ${msg.is_inbound ? "" : "items-end"}`}>
                            <div className="relative">
                              <div className={`rounded-2xl px-4 py-3 text-sm ${
                                msg.is_inbound
                                  ? "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
                                  : "bg-blue-600 text-white rounded-tr-none shadow-sm"
                              }`}>
                                {msg.htmlBody
                                  ? <div className="email-html-body text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.htmlBody) }} />
                                  : <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: plaintextToHtml(msg.body) }} />
                                }
                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-black/10 flex flex-wrap gap-2">
                                    {msg.attachments.map(att => (
                                      <button
                                        key={att.attachmentId}
                                        onClick={async () => {
                                          const token = localStorage.getItem("ws_token");
                                          const params = new URLSearchParams({
                                            channel: activeChannel,
                                            filename: att.filename,
                                            mimeType: att.mimeType,
                                          });
                                          const res = await fetch(
                                            `${API}/api/gmail/attachments/${att.messageId}/${att.attachmentId}?${params}`,
                                            { headers: { Authorization: `Bearer ${token}` } }
                                          );
                                          const blob = await res.blob();
                                          const url = URL.createObjectURL(blob);
                                          setViewingFile({ url, filename: att.filename, mimeType: att.mimeType, size: att.size });
                                        }}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/80 hover:bg-white border border-black/10 text-gray-700 transition shadow-sm max-w-[180px]"
                                        title={att.filename}
                                      >
                                        <span className="flex-shrink-0">
                                          {att.mimeType.startsWith("image/") ? "🖼️" :
                                           att.mimeType.startsWith("video/") ? "🎬" :
                                           att.mimeType === "application/pdf" ? "📄" : "📎"}
                                        </span>
                                        <span className="truncate">{att.filename}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => insertMessage(msg.body, msg.from.name)}
                                title="Send to AI"
                                className={`absolute -top-2 ${msg.is_inbound ? "-right-2" : "-left-2"} opacity-0 group-hover/msg:opacity-100 transition-opacity w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center hover:bg-emerald-200 shadow-sm border border-emerald-200`}
                              >
                                ✨
                              </button>
                            </div>
                            <div className={`flex items-center gap-1.5 mt-1 ${msg.is_inbound ? "" : "flex-row-reverse"}`}>
                              <span className="text-xs text-gray-400">{msg.from.name}</span>
                              <span className="text-gray-300 text-xs">·</span>
                              <span className="text-xs text-gray-400">{formatDate(msg.created_at)} {formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Reply composer — show for inbox/all/snoozed, hide for spam/trash/archived */}
                    {canWrite && activeTab !== "spam" && activeTab !== "trash" && activeTab !== "archived" ? (
                      <ReplyComposer
                        contactName={selected.recipient.name}
                        accent="blue"
                        replyEndpoint={`/api/gmail/threads/${selected.id}/reply?channel=${activeChannel}`}
                        onSent={refreshConversation}
                        onArchive={async () => {
                          if (!selected) return;
                          await axios.patch(`${API}/api/gmail/threads/${selected.id}/archive`, { channel: activeChannel });
                          setConversations(prev => prev.filter(c => c.id !== selected.id));
                          setSelected(null);
                          fetchList();
                        }}
                      />
                    ) : (
                      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3 text-center">
                        <p className="text-xs text-gray-400">
                          {activeTab === "spam" ? "This conversation is in spam." :
                           activeTab === "trash" ? "This conversation is in trash." :
                           "This conversation is archived."}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Notes tab */}
                {detailTab === "notes" && (
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <InternalNotes channel="gmail" externalId={selected.id} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT: customer panel */}
          {selected && !aiOpen && (
            <CustomerPanel
              email={selected.recipient.email}
              name={selected.recipient.name}
            />
          )}
        </div>

        {/* Compose modal */}
        {composeOpen && (
          <ComposeModal
            onClose={() => setComposeOpen(false)}
            onSent={fetchList}
          />
        )}

        {/* Draft editing modal */}
        {editingDraft && (
          <ComposeModal
            draftId={editingDraft.id}
            initialTo={editingDraft.to}
            initialSubject={editingDraft.subject}
            initialBody={editingDraft.body}
            onClose={() => setEditingDraft(null)}
            onSent={fetchList}
          />
        )}
      </div>

      {/* BulkActionBar — rendered outside the main layout (fixed position) */}
      <BulkActionBar
        selectedIds={selectedIds}
        channel="gmail"
        gmailInbox="support"
        onClear={() => setSelectedIds([])}
        onDone={fetchList}
      />

      {/* File viewer modal */}
      {viewingFile && (
        <FileViewer
          file={viewingFile}
          onClose={() => {
            URL.revokeObjectURL(viewingFile.url);
            setViewingFile(null);
          }}
        />
      )}
    </>
  );
}
