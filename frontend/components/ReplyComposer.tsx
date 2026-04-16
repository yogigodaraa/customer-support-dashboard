"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Template {
  id: string;
  title: string;
  body: string;
  category: string;
}

interface Props {
  contactName: string;
  /** Tailwind color name: "purple" | "blue" */
  accent: "purple" | "blue";
  /** Full URL to POST the reply to, e.g. /api/intercom/conversations/123/reply */
  replyEndpoint: string;
  /** Called after a successful send so the parent can refresh the conversation */
  onSent?: () => void;
  /** Called for "Send & Archive" — if provided, shows the option */
  onArchive?: () => Promise<void> | void;
}

// ─── Toolbar button ──────────────────────────────────────────────────────────

function TbBtn({ icon, title, active, onClick }: { icon: React.ReactNode; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition ${
        active
          ? "bg-gray-200 text-gray-900"
          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      }`}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

// ─── Link modal ──────────────────────────────────────────────────────────────

function LinkModal({ onInsert, onClose }: { onInsert: (url: string, text: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState("https://");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="absolute bottom-full left-0 mb-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 z-40 w-72">
      <p className="text-xs font-semibold text-gray-700 mb-2">Insert Link</p>
      <input
        ref={inputRef}
        type="text"
        placeholder="Display text"
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full px-3 py-1.5 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
      />
      <input
        type="url"
        placeholder="https://example.com"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { onInsert(url, text || url); } if (e.key === "Escape") onClose(); }}
        className="w-full px-3 py-1.5 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
        <button onClick={() => onInsert(url, text || url)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">Insert</button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const COMMON_EMOJIS = ["😊","😂","❤️","👍","🙏","🎉","✅","❌","🔥","💡","⚠️","📝","📧","🔒","💬","📞","🚀","⏰","📅","✨","🎯","💪","🤝","😅","🙈","💯","🎊","🌟","📌","🔑","💸","🏆","⚡","🛡️","🔔","📊","🗂️","🧩","✍️","🌈"];

export default function ReplyComposer({ contactName, accent, replyEndpoint, onSent, onArchive }: Props) {
  const [sending, setSending] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPayloadRef = useRef<{ text: string; html: string; action: "send" | "archive" | "snooze"; snoozeLabel?: string } | null>(null);
  const [sendMode, setSendMode] = useState<"send" | "archive" | "snooze">("send");
  const [showSendMenu, setShowSendMenu] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const sendMenuRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateSearchRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const { toast } = useToast();

  // Focus template search when picker opens
  useEffect(() => {
    if (showTemplates) setTimeout(() => templateSearchRef.current?.focus(), 30);
  }, [showTemplates]);

  // Save selection whenever it changes inside editor
  const updateActiveFormats = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
    const formats = new Set<string>();
    try {
      if (document.queryCommandState("bold")) formats.add("bold");
      if (document.queryCommandState("italic")) formats.add("italic");
      if (document.queryCommandState("underline")) formats.add("underline");
      if (document.queryCommandState("strikeThrough")) formats.add("strikethrough");
      if (document.queryCommandState("insertOrderedList")) formats.add("orderedList");
      if (document.queryCommandState("insertUnorderedList")) formats.add("unorderedList");
    } catch { /* ignore */ }
    setActiveFormats(formats);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveFormats);
    return () => document.removeEventListener("selectionchange", updateActiveFormats);
  }, [updateActiveFormats]);

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else {
      // Place cursor at end if no saved range
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function exec(command: string, value?: string) {
    restoreSelection();
    document.execCommand(command, false, value);
    updateActiveFormats();
  }

  function getEditorText(): string {
    return editorRef.current?.innerText?.trim() || "";
  }

  function getEditorHtml(): string {
    return editorRef.current?.innerHTML?.trim() || "";
  }

  function clearEditor() {
    if (editorRef.current) editorRef.current.innerHTML = "";
  }

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
    const firstName = contactName.split(" ")[0] || contactName;
    return text
      .replace(/\{\{customer_name\}\}/gi, firstName)
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{agent_name\}\}/gi, "WeSupport")
      .replace(/\{\{end_date\}\}/gi, new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }));
  }

  function insertTemplate(tpl: Template) {
    if (editorRef.current) {
      const resolved = resolveTemplatePlaceholders(tpl.body);
      editorRef.current.innerText = resolved;
    }
    setShowTemplates(false);
    editorRef.current?.focus();
  }

  function insertLink(url: string, text: string) {
    exec("insertHTML", `<a href="${url}" style="color:#2563eb;text-decoration:underline">${text}</a>`);
    setShowLink(false);
  }

  function handleAttach() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAttachments(prev => [...prev, ...files]);
    toast(`${files.length} file${files.length > 1 ? "s" : ""} attached`);
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  function handleEditorKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendReply();
      return;
    }
    if (e.key === "/" && getEditorText() === "") {
      e.preventDefault();
      openTemplatePicker();
      return;
    }
    // Keyboard shortcuts for formatting
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "b") { e.preventDefault(); exec("bold"); }
      if (e.key === "i") { e.preventDefault(); exec("italic"); }
      if (e.key === "u") { e.preventDefault(); exec("underline"); }
      if (e.key === "k") { e.preventDefault(); setShowLink(true); }
    }
    if (e.key === "Escape") {
      setShowTemplates(false);
      setShowLink(false);
    }
  }

  const filteredTemplates = templates.filter(t =>
    !templateSearch ||
    t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Close send menu on outside click
  useEffect(() => {
    if (!showSendMenu && !showSnoozeMenu) return;
    function handleClick(e: MouseEvent) {
      if (sendMenuRef.current && !sendMenuRef.current.contains(e.target as Node)) {
        setShowSendMenu(false);
        setShowSnoozeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSendMenu, showSnoozeMenu]);

  function cancelUndo() {
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null; }
    setUndoCountdown(null);
    pendingPayloadRef.current = null;
  }

  async function executeSend(action: "send" | "archive" | "snooze", text: string, html: string, snoozeLabel?: string) {
    setSending(true);
    try {
      await axios.post(`${API}${replyEndpoint}`, { body: text, html });
      clearEditor();
      setAttachments([]);
      if (action === "archive" && onArchive) { await onArchive(); toast("Sent & archived"); }
      else if (action === "snooze" && onArchive) { await onArchive(); toast(`Sent & snoozed${snoozeLabel ? ` — back ${snoozeLabel}` : ""}`); }
      else { toast("Reply sent"); }
      onSent?.();
    } catch {
      toast("Failed to send reply", "error");
    } finally {
      setSending(false);
      setShowSendMenu(false);
      setShowSnoozeMenu(false);
    }
  }

  function sendReply(mode?: "send" | "archive" | "snooze", snoozeLabel?: string) {
    const action = mode || sendMode;
    const text = getEditorText();
    if (!text || sending || undoCountdown !== null) return;
    const html = getEditorHtml();
    pendingPayloadRef.current = { text, html, action, snoozeLabel };
    setUndoCountdown(5);
    setShowSendMenu(false);
    setShowSnoozeMenu(false);
    undoIntervalRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    undoTimerRef.current = setTimeout(() => {
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null; }
      setUndoCountdown(null);
      const payload = pendingPayloadRef.current;
      pendingPayloadRef.current = null;
      if (payload) executeSend(payload.action, payload.text, payload.html, payload.snoozeLabel);
    }, 5000);
  }

  const SNOOZE_OPTIONS = [
    { label: "in 1 hour", ms: 3600000 },
    { label: "in 4 hours", ms: 14400000 },
    { label: "tomorrow", ms: 86400000 },
    { label: "next week", ms: 604800000 },
  ];

  const sendLabel = sendMode === "archive" ? "Send & Archive" : sendMode === "snooze" ? "Send & Snooze" : "Send";

  const colors = accent === "purple"
    ? { ring: "focus-within:ring-purple-400", btn: "bg-purple-600 hover:bg-purple-700", picker: "focus:ring-purple-300" }
    : { ring: "focus-within:ring-blue-400",   btn: "bg-blue-600 hover:bg-blue-700",     picker: "focus:ring-blue-300"   };

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
      <div className={`relative bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 ${colors.ring} focus-within:border-transparent transition-shadow`}>

        {/* Template picker */}
        {showTemplates && (
          <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-30">
            <div className="p-2 border-b border-gray-100">
              <input
                ref={templateSearchRef}
                type="text"
                placeholder="Search templates…"
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                onKeyDown={e => e.key === "Escape" && setShowTemplates(false)}
                className={`w-full px-3 py-1.5 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 ${colors.picker}`}
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

        {/* Link modal */}
        {showLink && (
          <LinkModal
            onInsert={insertLink}
            onClose={() => setShowLink(false)}
          />
        )}

        {/* Emoji picker */}
        {showEmoji && (
          <div className="absolute bottom-full left-0 mb-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl z-40 p-2 w-72">
            <div className="grid grid-cols-8 gap-0.5">
              {COMMON_EMOJIS.map(em => (
                <button
                  key={em}
                  onMouseDown={e => {
                    e.preventDefault();
                    restoreSelection();
                    exec("insertText", em);
                    setShowEmoji(false);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded-md transition"
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          onKeyDown={handleEditorKeyDown}
          data-placeholder={`Reply to ${contactName}… (type / for templates · ⌘↵ to send)`}
          className="w-full px-4 pt-3 pb-2 text-sm bg-transparent border-0 resize-none focus:outline-none leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
          style={{ minHeight: "52px", maxHeight: "200px", overflowY: "auto" }}
        />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-3 pb-1.5 flex flex-wrap gap-1.5">
            {attachments.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 pl-2 pr-1 py-0.5 rounded-md border border-blue-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button onClick={() => removeAttachment(i)} className="text-blue-400 hover:text-blue-700 ml-0.5">&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Undo-send countdown */}
        {undoCountdown !== null && (
          <div className="flex items-center gap-3 px-3 py-2 bg-amber-50 border-t border-amber-100">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-4 h-4 relative">
                <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.3" />
                  <circle cx="8" cy="8" r="6" fill="none" stroke="#f59e0b" strokeWidth="2"
                    strokeDasharray={`${(undoCountdown / 5) * 37.7} 37.7`} strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-xs text-amber-700 font-medium">Sending in {undoCountdown}s…</span>
            </div>
            <button
              onMouseDown={e => { e.preventDefault(); cancelUndo(); }}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-0.5 rounded border border-amber-300 hover:border-amber-500 transition"
            >
              Undo
            </button>
          </div>
        )}

        {/* Toolbar + send */}
        <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
          {/* Left: formatting toolbar */}
          <div className="flex items-center gap-0.5 flex-wrap">
            {/* Text formatting */}
            <TbBtn
              icon={<span className="font-bold text-[11px]">B</span>}
              title="Bold (⌘B)"
              active={activeFormats.has("bold")}
              onClick={() => exec("bold")}
            />
            <TbBtn
              icon={<span className="italic text-[11px]">I</span>}
              title="Italic (⌘I)"
              active={activeFormats.has("italic")}
              onClick={() => exec("italic")}
            />
            <TbBtn
              icon={<span className="underline text-[11px]">U</span>}
              title="Underline (⌘U)"
              active={activeFormats.has("underline")}
              onClick={() => exec("underline")}
            />
            <TbBtn
              icon={<span className="line-through text-[11px]">S</span>}
              title="Strikethrough"
              active={activeFormats.has("strikethrough")}
              onClick={() => exec("strikeThrough")}
            />

            <Divider />

            {/* Lists */}
            <TbBtn
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /><circle cx="1" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="1" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="1" cy="18" r="1" fill="currentColor" stroke="none" /></svg>}
              title="Bullet list"
              active={activeFormats.has("unorderedList")}
              onClick={() => exec("insertUnorderedList")}
            />
            <TbBtn
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13" /><text x="0" y="8" fill="currentColor" fontSize="8" fontFamily="sans-serif" stroke="none">1</text><text x="0" y="14" fill="currentColor" fontSize="8" fontFamily="sans-serif" stroke="none">2</text><text x="0" y="20" fill="currentColor" fontSize="8" fontFamily="sans-serif" stroke="none">3</text></svg>}
              title="Numbered list"
              active={activeFormats.has("orderedList")}
              onClick={() => exec("insertOrderedList")}
            />

            <Divider />

            {/* Link */}
            <TbBtn
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
              title="Insert link (⌘K)"
              onClick={() => setShowLink(true)}
            />

            {/* Attach */}
            <TbBtn
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>}
              title="Attach file"
              onClick={handleAttach}
            />

            {/* Code */}
            <TbBtn
              icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
              title="Code"
              onClick={() => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && sel.toString()) {
                  exec("insertHTML", `<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:0.85em;font-family:monospace">${sel.toString()}</code>`);
                } else {
                  exec("formatBlock", "pre");
                }
              }}
            />

            <Divider />

            {/* Templates */}
            <TbBtn
              icon={<span className="text-[11px]">📋</span>}
              title="Insert template (or type /)"
              onClick={openTemplatePicker}
            />

            {/* Emoji */}
            <TbBtn
              icon={<span className="text-[11px]">😊</span>}
              title="Insert emoji"
              active={showEmoji}
              onClick={() => setShowEmoji(v => !v)}
            />
          </div>

          {/* Right: split send button */}
          <div className="flex items-center flex-shrink-0 relative" ref={sendMenuRef}>
            <button
              onClick={() => sendReply()}
              disabled={sending}
              className={`px-3 py-1.5 ${colors.btn} text-white text-xs font-medium rounded-l-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5`}
            >
              {sending && (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              )}
              {sendLabel}
            </button>
            <button
              onClick={() => { setShowSendMenu(v => !v); setShowSnoozeMenu(false); }}
              disabled={sending}
              className={`px-1.5 ${colors.btn} text-white text-xs font-medium rounded-r-lg border-l border-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center self-stretch`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {/* Send options dropdown */}
            {showSendMenu && (
              <div className="absolute bottom-full right-0 mb-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-40 w-48">
                <button
                  onClick={() => { setSendMode("send"); setShowSendMenu(false); sendReply("send"); }}
                  className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-gray-50 transition flex items-center gap-2 ${sendMode === "send" ? "font-semibold text-gray-900" : "text-gray-700"}`}
                >
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  Send
                  <span className="ml-auto text-gray-300 text-[10px]">&#8984;&#9166;</span>
                </button>
                {onArchive && (
                  <>
                    <button
                      onClick={() => { setSendMode("archive"); setShowSendMenu(false); sendReply("archive"); }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-gray-50 transition flex items-center gap-2 border-t border-gray-50 ${sendMode === "archive" ? "font-semibold text-gray-900" : "text-gray-700"}`}
                    >
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      Send & Archive
                    </button>
                    <button
                      onClick={() => { setShowSnoozeMenu(v => !v); }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-gray-50 transition flex items-center gap-2 border-t border-gray-50 ${sendMode === "snooze" ? "font-semibold text-gray-900" : "text-gray-700"}`}
                    >
                      <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Send & Snooze
                      <svg className="w-3 h-3 ml-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </>
                )}

                {/* Snooze sub-menu */}
                {showSnoozeMenu && onArchive && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {SNOOZE_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => { setSendMode("snooze"); sendReply("snooze", opt.label); }}
                        className="w-full text-left px-3.5 py-2 text-xs text-gray-600 hover:bg-gray-100 transition pl-9"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
