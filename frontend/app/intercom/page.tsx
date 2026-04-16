"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import ReplyComposer from "@/components/ReplyComposer";
import CustomerPanel from "@/components/CustomerPanel";
import { useToast } from "@/components/Toast";
import { useAiChat } from "@/components/AiChatContext";
import { useCanWrite } from "@/components/RoleGate";
import CollisionBanner from "@/components/CollisionBanner";
import TagPicker from "@/components/TagPicker";
import SnoozeButton from "@/components/SnoozeButton";
import SlaIndicator from "@/components/SlaIndicator";
import InternalNotes from "@/components/InternalNotes";
import BulkActionBar from "@/components/BulkActionBar";
import { useWebSocket } from "@/components/WebSocketContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Conversation {
  id: string;
  title: string;
  state: "open" | "closed";
  contact: { name: string; email: string; avatar: string };
  assignee: { name: string } | null;
  channel: string;
  created_at: string;
  last_message_at: string;
  last_message_preview: string;
  time_ago: string;
}

interface Message {
  id: string;
  from: { name: string; type: "user" | "agent" | "bot" };
  body: string;
  created_at: string;
  is_inbound: boolean;
}

interface ConversationDetail extends Conversation {
  messages: Message[];
}

interface Counts { all: number; open: number; closed: number }

function initials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

const AVATAR_COLORS = [
  "from-violet-400 to-violet-600",
  "from-emerald-400 to-emerald-600",
  "from-sky-400 to-sky-600",
  "from-rose-400 to-rose-600",
  "from-amber-400 to-amber-600",
  "from-teal-400 to-teal-600",
];
function avatarColor(name: string) {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function IntercomPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, open: 0, closed: 0 });
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "open" | "closed" | "snoozed">("open");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { injectContext, insertMessage, isOpen: aiOpen } = useAiChat();
  const canWrite = useCanWrite();

  // Phase 2: multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Phase 2: snoozed set for tab filtering
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());

  // Phase 2: snoozedUntil for currently selected conversation
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);

  // Attributes: pin, priority, due date
  const [isPinned, setIsPinned] = useState(false);
  const [priority, setPriority] = useState<"urgent" | "high" | "normal" | "low">("normal");
  const [dueAt, setDueAt] = useState<string>("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  // Phase 2: detail body tab ("messages" | "notes")
  const [detailTab, setDetailTab] = useState<"messages" | "notes">("messages");

  // Phase 2: track previous selected id for presence:left
  const prevSelectedIdRef = useRef<string | null>(null);

  const { subscribe, on, off, emit } = useWebSocket();

  const fetchList = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      // For the snoozed tab we fetch "all" from the API and filter client-side
      if (activeTab !== "all" && activeTab !== "snoozed") params.state = activeTab;
      if (search) params.q = search;
      const res = await axios.get(`${API}/api/intercom/conversations`, { params });
      setConversations(res.data.conversations);
      setCounts(res.data.counts);
    } catch { /* silently ignore */ }
    finally { setIsLoading(false); }
  }, [activeTab, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Phase 2: subscribe to "intercom" channel on mount
  useEffect(() => {
    subscribe("intercom");
  }, [subscribe]);

  // Phase 2: conversation:updated → refresh list
  useEffect(() => {
    function handleConversationUpdated() {
      fetchList();
    }
    on("conversation:updated", handleConversationUpdated);
    return () => {
      off("conversation:updated", handleConversationUpdated);
    };
  }, [on, off, fetchList]);

  // Phase 2: snoozed / unsnoozed WebSocket events
  useEffect(() => {
    function handleSnoozed(payload: { id?: string; externalId?: string }) {
      const id = payload.id ?? payload.externalId;
      if (!id) return;
      setSnoozedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    function handleUnsnoozed(payload: { id?: string; externalId?: string }) {
      const id = payload.id ?? payload.externalId;
      if (!id) return;
      setSnoozedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchList();
    }
    on("conversation:snoozed", handleSnoozed);
    on("conversation:unsnoozed", handleUnsnoozed);
    return () => {
      off("conversation:snoozed", handleSnoozed);
      off("conversation:unsnoozed", handleUnsnoozed);
    };
  }, [on, off, fetchList]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (selected) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [selected?.id, selected?.messages.length]);

  // Phase 2: emit presence events when selected conversation changes
  useEffect(() => {
    const prevId = prevSelectedIdRef.current;

    // Leaving previous conversation
    if (prevId && prevId !== selected?.id) {
      emit("presence:left", { channel: "intercom", externalId: prevId });
    }

    // Viewing new conversation
    if (selected) {
      emit("presence:viewing", { channel: "intercom", externalId: selected.id });
    }

    prevSelectedIdRef.current = selected?.id ?? null;
  }, [selected?.id, emit]);

  async function openConversation(c: Conversation) {
    setDetailLoading(true);
    setDetailTab("messages");
    try {
      const res = await axios.get(`${API}/api/intercom/conversations/${c.id}`);
      const detail = res.data as ConversationDetail;
      setSelected(detail);
      injectContext({
        source: "intercom",
        conversationId: detail.id,
        subject: detail.title,
        contactName: detail.contact.name,
        contactEmail: detail.contact.email,
        messages: detail.messages.map(m => ({
          from: m.from.name,
          body: m.body,
          isInbound: m.is_inbound,
          createdAt: m.created_at,
        })),
      });
      // Phase 2: fetch meta for snoozedUntil + attributes
      try {
        const metaRes = await axios.get(`${API}/api/meta/intercom/${c.id}`);
        setSnoozedUntil(metaRes.data?.snoozedUntil ?? null);
        const pinned = metaRes.data?.isPinned ?? false;
        setIsPinned(pinned);
        setPriority(metaRes.data?.priority ?? "normal");
        setDueAt(metaRes.data?.dueAt ? metaRes.data.dueAt.slice(0, 10) : "");
        if (pinned) setPinnedIds(prev => { const n = new Set(prev); n.add(c.id); return n; });
        else setPinnedIds(prev => { const n = new Set(prev); n.delete(c.id); return n; });
      } catch {
        setSnoozedUntil(null);
        setIsPinned(false);
        setPriority("normal");
        setDueAt("");
      }
    } catch { toast("Could not load conversation", "error"); }
    finally { setDetailLoading(false); }
  }

  async function refreshConversation() {
    if (!selected) return;
    try {
      const res = await axios.get(`${API}/api/intercom/conversations/${selected.id}`);
      const detail = res.data as ConversationDetail;
      setSelected(detail);
      injectContext({
        source: "intercom",
        conversationId: detail.id,
        subject: detail.title,
        contactName: detail.contact.name,
        contactEmail: detail.contact.email,
        messages: detail.messages.map(m => ({
          from: m.from.name,
          body: m.body,
          isInbound: m.is_inbound,
          createdAt: m.created_at,
        })),
      });
    } catch { /* silently ignore */ }
  }

  async function resolveConversation() {
    if (!selected || actionLoading) return;
    setActionLoading("resolve");
    try {
      await axios.put(`${API}/api/intercom/conversations/${selected.id}/state`, { state: "closed" });
      setSelected(prev => prev ? { ...prev, state: "closed" } : prev);
      setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, state: "closed" } : c));
      setCounts(prev => ({ ...prev, open: Math.max(0, prev.open - 1), closed: prev.closed + 1 }));
      toast("Conversation resolved");
    } catch {
      toast("Failed to resolve", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function reopenConversation() {
    if (!selected || actionLoading) return;
    setActionLoading("reopen");
    try {
      await axios.put(`${API}/api/intercom/conversations/${selected.id}/state`, { state: "open" });
      setSelected(prev => prev ? { ...prev, state: "open" } : prev);
      setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, state: "open" } : c));
      setCounts(prev => ({ ...prev, open: prev.open + 1, closed: Math.max(0, prev.closed - 1) }));
      toast("Conversation reopened");
    } catch {
      toast("Failed to reopen", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function assignConversation() {
    if (!selected || !assignEmail.trim() || actionLoading) return;
    setActionLoading("assign");
    try {
      await axios.put(`${API}/api/intercom/conversations/${selected.id}/assign`, {
        assignee_email: assignEmail.trim(),
      });
      setSelected(prev => prev ? { ...prev, assignee: { name: assignEmail.trim() } } : prev);
      toast(`Assigned to ${assignEmail.trim()}`);
      setShowAssignModal(false);
      setAssignEmail("");
    } catch {
      toast("Failed to assign", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function patchAttributes(patch: { isPinned?: boolean; priority?: string; dueAt?: string | null }) {
    if (!selected) return;
    try {
      await axios.patch(`${API}/api/meta/intercom/${selected.id}/attributes`, patch);
      if (patch.isPinned !== undefined) {
        setIsPinned(patch.isPinned);
        if (patch.isPinned) setPinnedIds(prev => { const n = new Set(prev); n.add(selected.id); return n; });
        else setPinnedIds(prev => { const n = new Set(prev); n.delete(selected.id); return n; });
      }
      if (patch.priority !== undefined) setPriority(patch.priority as "urgent" | "high" | "normal" | "low");
      if (patch.dueAt !== undefined) setDueAt(patch.dueAt ? patch.dueAt.slice(0, 10) : "");
    } catch { toast("Failed to update", "error"); }
  }

  // Phase 2: toggle a conversation in the multi-select set
  function toggleSelected(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // Phase 2: derive filtered list for snoozed tab, sorted with pinned first
  const displayedConversations = (
    activeTab === "snoozed"
      ? conversations.filter(c => snoozedIds.has(c.id))
      : conversations
  ).sort((a, b) => {
    const pa = pinnedIds.has(a.id) ? 1 : 0;
    const pb = pinnedIds.has(b.id) ? 1 : 0;
    return pb - pa;
  });

  const anySelected = selectedIds.length > 0;

  const TABS = [
    { key: "open",    label: "Open",    count: counts.open },
    { key: "closed",  label: "Closed",  count: counts.closed },
    { key: "all",     label: "All",     count: counts.all },
    { key: "snoozed", label: "Snoozed", count: snoozedIds.size },
  ] as const;

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>

      {/* Top bar */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-lg">💬</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Intercom</h1>
            <p className="text-xs text-gray-400">In-app customer conversations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{counts.open} open</span>
          <div className={`w-2.5 h-2.5 rounded-full ${counts.open > 0 ? "bg-purple-400 animate-pulse" : "bg-green-400"}`} />
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
                placeholder="Search conversations…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div className="flex border-b border-gray-100 px-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSelected(null); }}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  activeTab === t.key
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === t.key ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
                  }`}>{t.count}</span>
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
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedConversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No conversations</div>
            ) : displayedConversations.map(c => (
              <div
                key={c.id}
                className={`relative w-full text-left border-b border-gray-50 transition group/item ${
                  selected?.id === c.id
                    ? "bg-purple-50 border-l-2 border-l-purple-600"
                    : "hover:bg-gray-50"
                }`}
              >
                {/* Checkbox: always visible when any item selected, otherwise shows on group hover */}
                <div
                  className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 ${
                    anySelected ? "flex" : "hidden group-hover/item:flex"
                  } items-center`}
                  onClick={e => toggleSelected(c.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => {}}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400 cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => openConversation(c)}
                  className={`w-full text-left px-3 py-3 transition ${anySelected ? "pl-8" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(c.contact.name)} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                      {initials(c.contact.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.contact.name}</p>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{c.time_ago}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate mt-0.5">{c.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{c.last_message_preview}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {pinnedIds.has(c.id) && <span className="text-xs">📌</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          c.state === "open" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
                        }`}>{c.state}</span>
                        {snoozedIds.has(c.id) && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">snoozed</span>
                        )}
                        {c.assignee ? (
                          <span className="text-xs text-gray-400 truncate">→ {c.assignee.name}</span>
                        ) : (
                          <span className="text-xs text-amber-600">Unassigned</span>
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
              <div className="text-5xl mb-4">💬</div>
              <p className="text-lg font-semibold text-gray-700">Select a conversation</p>
              <p className="text-sm text-gray-400 mt-1">Choose a chat from the list to see the full thread.</p>
              <p className="text-xs text-gray-300 mt-4">
                Tip: press <kbd className="border border-gray-200 rounded px-1 bg-white">⌘K</kbd> to search customers
              </p>
            </div>
          )}

          {detailLoading && (
            <div className="p-6 space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
            </div>
          )}

          {selected && !detailLoading && (
            <>
              {/* CollisionBanner: above the header */}
              <div className="flex-shrink-0 px-5 pt-3">
                <CollisionBanner channel="intercom" externalId={selected.id} />
              </div>

              {/* Header */}
              <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(selected.contact.name)} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                      {initials(selected.contact.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{selected.contact.name}</p>
                      <p className="text-xs text-gray-400 truncate">{selected.contact.email} · {selected.channel}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      selected.state === "open" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                    }`}>{selected.state}</span>

                    {selected.assignee ? (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">👤 {selected.assignee.name}</span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">Unassigned</span>
                    )}

                    {canWrite && (<>
                    {/* Assign modal trigger */}
                    <div className="relative">
                      <button
                        onClick={() => { setShowAssignModal(v => !v); setAssignEmail(""); }}
                        className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                      >
                        Assign
                      </button>
                      {showAssignModal && (
                        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-3 w-64">
                          <p className="text-xs font-medium text-gray-700 mb-2">Assign to agent</p>
                          <input
                            autoFocus
                            type="email"
                            placeholder="agent@company.com"
                            value={assignEmail}
                            onChange={e => setAssignEmail(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") assignConversation();
                              if (e.key === "Escape") setShowAssignModal(false);
                            }}
                            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 mb-2"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={assignConversation}
                              disabled={!assignEmail.trim() || actionLoading === "assign"}
                              className="flex-1 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                            >
                              {actionLoading === "assign" ? "Assigning…" : "Assign"}
                            </button>
                            <button
                              onClick={() => setShowAssignModal(false)}
                              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Resolve / Reopen */}
                    {selected.state === "open" ? (
                      <button
                        onClick={resolveConversation}
                        disabled={actionLoading === "resolve"}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoading === "resolve" && (
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        Resolve
                      </button>
                    ) : (
                      <button
                        onClick={reopenConversation}
                        disabled={actionLoading === "reopen"}
                        className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50"
                      >
                        {actionLoading === "reopen" ? "Opening…" : "Reopen"}
                      </button>
                    )}
                    </>)}
                  </div>
                </div>

                {/* Row 2: TagPicker + attributes + SnoozeButton + SlaIndicator */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <TagPicker channel="intercom" externalId={selected.id} />

                  {/* Pin button */}
                  {canWrite && (
                    <button
                      onClick={() => patchAttributes({ isPinned: !isPinned })}
                      title={isPinned ? "Unpin conversation" : "Pin conversation"}
                      className={`text-sm px-2 py-0.5 rounded-lg border transition ${isPinned ? "bg-amber-50 border-amber-300 text-amber-600" : "border-gray-200 text-gray-400 hover:text-amber-500 hover:border-amber-200"}`}
                    >
                      📌
                    </button>
                  )}

                  {/* Priority selector */}
                  {canWrite && (
                    <div className="relative">
                      <button
                        onClick={() => setShowPriorityMenu(v => !v)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-medium transition ${
                          priority === "urgent" ? "bg-red-50 text-red-700 border-red-200" :
                          priority === "high" ? "bg-orange-50 text-orange-600 border-orange-200" :
                          priority === "low" ? "bg-gray-50 text-gray-500 border-gray-200" :
                          "bg-blue-50 text-blue-600 border-blue-200"
                        }`}
                      >
                        {priority === "urgent" ? "🔴" : priority === "high" ? "🟠" : priority === "low" ? "⚪" : "🔵"} {priority}
                      </button>
                      {showPriorityMenu && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                          {(["urgent","high","normal","low"] as const).map(p => (
                            <button key={p} onClick={() => { patchAttributes({ priority: p }); setShowPriorityMenu(false); }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition ${priority === p ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                              {p === "urgent" ? "🔴" : p === "high" ? "🟠" : p === "low" ? "⚪" : "🔵"} {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Due date */}
                  {canWrite && (
                    <input
                      type="date"
                      value={dueAt}
                      onChange={e => patchAttributes({ dueAt: e.target.value || null })}
                      title="Due date"
                      className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                    />
                  )}

                  <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                    <SnoozeButton
                      channel="intercom"
                      externalId={selected.id}
                      snoozedUntil={snoozedUntil}
                      onChanged={(v) => {
                        setSnoozedUntil(v);
                        if (v) {
                          setSnoozedIds(prev => { const next = new Set(prev); next.add(selected.id); return next; });
                        } else {
                          setSnoozedIds(prev => { const next = new Set(prev); next.delete(selected.id); return next; });
                        }
                      }}
                    />
                    <SlaIndicator channel="intercom" externalId={selected.id} />
                  </div>
                </div>
              </div>

              {/* Messages | Notes tabs */}
              <div className="flex-shrink-0 flex border-b border-gray-200 bg-white px-5">
                <button
                  onClick={() => setDetailTab("messages")}
                  className={`py-2 px-1 mr-4 text-sm font-medium border-b-2 transition ${
                    detailTab === "messages"
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Messages
                </button>
                <button
                  onClick={() => setDetailTab("notes")}
                  className={`py-2 px-1 text-sm font-medium border-b-2 transition ${
                    detailTab === "notes"
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Notes
                </button>
              </div>

              {/* Tab body */}
              {detailTab === "messages" ? (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {selected.messages.map(msg => {
                      const isBot = msg.from.type === "bot";
                      const isAgent = msg.from.type === "agent";
                      return (
                        <div key={msg.id} className={`flex gap-3 ${msg.is_inbound ? "" : "flex-row-reverse"} group/msg`}>
                          <div className={`w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                            isBot   ? "bg-gradient-to-br from-gray-300 to-gray-500" :
                            isAgent ? "bg-gradient-to-br from-purple-500 to-purple-700" :
                            `bg-gradient-to-br ${avatarColor(msg.from.name)}`
                          }`}>
                            {isBot ? "🤖" : initials(msg.from.name)}
                          </div>
                          <div className={`max-w-[60%] flex flex-col ${msg.is_inbound ? "" : "items-end"}`}>
                            <div className="relative">
                              <div className={`rounded-2xl px-4 py-3 text-sm ${
                                msg.is_inbound
                                  ? "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
                                  : isBot
                                  ? "bg-gray-100 text-gray-700 rounded-tr-none"
                                  : "bg-purple-600 text-white rounded-tr-none shadow-sm"
                              }`}>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
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
                              {isBot && <span className="text-xs bg-gray-100 text-gray-500 px-1 rounded">Bot</span>}
                              <span className="text-gray-300 text-xs">·</span>
                              <span className="text-xs text-gray-400">{formatDate(msg.created_at)} {formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply */}
                  {canWrite && selected.state === "open" ? (
                    <ReplyComposer
                      contactName={selected.contact.name}
                      accent="purple"
                      replyEndpoint={`/api/intercom/conversations/${selected.id}/reply`}
                      onSent={refreshConversation}
                    />
                  ) : (
                    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3 text-center">
                      <p className="text-xs text-gray-400">
                        Conversation resolved.{canWrite && <>{" "}<button onClick={reopenConversation} className="text-purple-600 hover:underline">Reopen</button>{" "}to reply.</>}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* Notes tab */
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <InternalNotes channel="intercom" externalId={selected.id} />
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: customer panel (hidden when AI panel is open) */}
        {selected && !aiOpen && (
          <CustomerPanel
            email={selected.contact.email}
            name={selected.contact.name}
          />
        )}
      </div>

      {/* Phase 2: BulkActionBar — rendered outside the layout divs */}
      <BulkActionBar
        selectedIds={selectedIds}
        channel="intercom"
        onClear={() => setSelectedIds([])}
        onDone={fetchList}
      />
    </div>
  );
}
