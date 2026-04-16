"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useToast } from "@/components/Toast";
import { useCanWrite } from "@/components/RoleGate";
import TagPicker from "@/components/TagPicker";
import BulkActionBar from "@/components/BulkActionBar";
import { useWebSocket } from "@/components/WebSocketContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Bug {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  priority: "critical" | "high" | "medium" | "low";
  reporter: { name: string; email: string };
  assignee: { name: string } | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  time_ago: string;
}

interface Comment {
  id: string;
  from: { name: string; email: string };
  body: string;
  created_at: string;
  is_internal: boolean;
}

interface BugDetail extends Bug {
  comments: Comment[];
}

interface Counts { all: number; open: number; in_progress: number; closed: number; critical: number }

// ── Config maps ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: { label: "Critical", bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    border: "border-red-300",    activeBg: "bg-red-600 text-white" },
  high:     { label: "High",     bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-400", border: "border-orange-300", activeBg: "bg-orange-500 text-white" },
  medium:   { label: "Medium",   bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400", border: "border-yellow-300", activeBg: "bg-yellow-500 text-white" },
  low:      { label: "Low",      bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400",   border: "border-gray-300",   activeBg: "bg-gray-600 text-white"   },
} as const;

const STATUS_CONFIG = {
  open:        { label: "Open",        bg: "bg-red-100",   text: "text-red-700"   },
  in_progress: { label: "In Progress", bg: "bg-blue-100",  text: "text-blue-700"  },
  closed:      { label: "Closed",      bg: "bg-green-100", text: "text-green-700" },
} as const;

// Left border colour per priority
const PRIORITY_BORDER = {
  critical: "border-l-red-500",
  high:     "border-l-orange-400",
  medium:   "border-l-yellow-400",
  low:      "border-l-gray-300",
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LuciqPage() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, open: 0, in_progress: 0, closed: 0, critical: 0 });
  const [selected, setSelected] = useState<BugDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "open" | "in_progress" | "closed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);
  const [commentPosting, setCommentPosting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast();
  const canWrite = useCanWrite();
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const { subscribe, unsubscribe, on, off } = useWebSocket();

  const fetchBugs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (activeTab !== "all") params.status = activeTab;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (search) params.q = search;
      const res = await axios.get(`${API}/api/luciq/bugs`, { params });
      setBugs(res.data.bugs);
      setCounts(res.data.counts);
    } catch { /* silently ignore */ }
    finally { setIsLoading(false); }
  }, [activeTab, priorityFilter, search]);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  // ── WebSocket subscription ──────────────────────────────────────────────────
  useEffect(() => {
    subscribe("luciq");
    function handleBugUpdated() {
      fetchBugs();
    }
    on("bug:updated", handleBugUpdated);
    return () => {
      off("bug:updated", handleBugUpdated);
      unsubscribe("luciq");
    };
  }, [subscribe, unsubscribe, on, off, fetchBugs]);

  async function openBug(b: Bug) {
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/api/luciq/bugs/${b.id}`);
      setSelected(res.data);
    } catch { toast("Could not load bug", "error"); }
    finally { setDetailLoading(false); }
  }

  async function refreshSelected() {
    if (!selected) return;
    try {
      const res = await axios.get(`${API}/api/luciq/bugs/${selected.id}`);
      setSelected(res.data);
      // Also update list entry
      setBugs(prev => prev.map(b => b.id === selected.id ? { ...res.data } : b));
    } catch { /* silently ignore */ }
  }

  // ── Status change ──────────────────────────────────────────────────────────
  async function setStatus(newStatus: Bug["status"]) {
    if (!selected || actionLoading) return;
    setActionLoading("status");
    try {
      const res = await axios.patch(`${API}/api/luciq/bugs/${selected.id}`, { status: newStatus });
      setSelected(res.data);
      setBugs(prev => prev.map(b => b.id === selected.id ? { ...b, status: newStatus, time_ago: res.data.time_ago } : b));
      setCounts(prev => {
        const next = { ...prev };
        next[selected.status] = Math.max(0, next[selected.status] - 1);
        next[newStatus] += 1;
        return next;
      });
      const labels: Record<Bug["status"], string> = { open: "Reopened", in_progress: "Marked In Progress", closed: "Resolved" };
      toast(labels[newStatus]);
    } catch {
      toast("Failed to update status", "error");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Priority change ────────────────────────────────────────────────────────
  async function setPriority(newPriority: Bug["priority"]) {
    if (!selected || actionLoading) return;
    setActionLoading("priority");
    try {
      const res = await axios.patch(`${API}/api/luciq/bugs/${selected.id}`, { priority: newPriority });
      setSelected(res.data);
      setBugs(prev => prev.map(b => b.id === selected.id ? { ...b, priority: newPriority } : b));
      const newCritical = selected.priority !== "critical" && newPriority === "critical"
        ? counts.critical + 1
        : selected.priority === "critical" && newPriority !== "critical"
        ? Math.max(0, counts.critical - 1)
        : counts.critical;
      setCounts(prev => ({ ...prev, critical: newCritical }));
      toast(`Priority set to ${PRIORITY_CONFIG[newPriority].label}`);
    } catch {
      toast("Failed to update priority", "error");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Assign ─────────────────────────────────────────────────────────────────
  async function assignBug() {
    if (!selected || !assignEmail.trim() || actionLoading) return;
    setActionLoading("assign");
    try {
      const res = await axios.patch(`${API}/api/luciq/bugs/${selected.id}`, { assignee_email: assignEmail.trim() });
      setSelected(res.data);
      toast(`Assigned to ${assignEmail.trim()}`);
      setShowAssignModal(false);
      setAssignEmail("");
    } catch {
      toast("Failed to assign", "error");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Comment ────────────────────────────────────────────────────────────────
  async function postComment() {
    if (!selected || !commentBody.trim() || commentPosting) return;
    setCommentPosting(true);
    try {
      await axios.post(`${API}/api/luciq/bugs/${selected.id}/comments`, {
        body: commentBody.trim(),
        is_internal: String(commentInternal),
      });
      setCommentBody("");
      setCommentInternal(false);
      toast(commentInternal ? "Internal note added" : "Comment posted");
      await refreshSelected();
    } catch {
      toast("Failed to post comment", "error");
    } finally {
      setCommentPosting(false);
    }
  }

  const TABS = [
    { key: "all",         label: "All",         count: counts.all },
    { key: "open",        label: "Open",         count: counts.open },
    { key: "in_progress", label: "In Progress",  count: counts.in_progress },
    { key: "closed",      label: "Closed",       count: counts.closed },
  ] as const;

  const PRIORITY_FILTERS = [
    { key: "all",      label: "All" },
    { key: "critical", label: "Critical", dot: "bg-red-500" },
    { key: "high",     label: "High",     dot: "bg-orange-400" },
    { key: "medium",   label: "Medium",   dot: "bg-yellow-400" },
    { key: "low",      label: "Low",      dot: "bg-gray-400" },
  ] as const;

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>

      {/* Top bar */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center text-lg">🐛</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Luciq Bug Tracker</h1>
            <p className="text-xs text-gray-400">Issue tracking &amp; bug reports</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {counts.critical > 0 && (
            <span className="flex items-center gap-1.5 text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {counts.critical} critical
            </span>
          )}
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: bug list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">

          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search bugs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex border-b border-gray-100 px-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSelected(null); }}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  activeTab === t.key
                    ? "text-red-600 border-b-2 border-red-500"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === t.key ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Priority quick-filters */}
          <div className="px-3 py-2 flex items-center gap-1.5 border-b border-gray-100 flex-wrap">
            {PRIORITY_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setPriorityFilter(f.key); setSelected(null); }}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition border ${
                  priorityFilter === f.key
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {"dot" in f && (
                  <span className={`w-1.5 h-1.5 rounded-full ${f.dot} ${priorityFilter === f.key ? "opacity-100" : ""}`} />
                )}
                {f.label}
              </button>
            ))}
          </div>

          {/* Bug list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                  </div>
                ))}
              </div>
            ) : bugs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No bugs found</div>
            ) : bugs.map(b => {
              const p = PRIORITY_CONFIG[b.priority];
              const s = STATUS_CONFIG[b.status];
              const isSelected = selected?.id === b.id;
              const isChecked = selectedIds.includes(b.id);
              return (
                <div
                  key={b.id}
                  className={`group relative border-b border-gray-50 border-l-2 transition ${
                    isSelected
                      ? `bg-red-50 ${PRIORITY_BORDER[b.priority]}`
                      : `${PRIORITY_BORDER[b.priority]} hover:bg-gray-50`
                  }`}
                >
                  {/* Checkbox — visible on hover or when checked */}
                  <div className={`absolute left-2 top-1/2 -translate-y-1/2 transition-opacity ${
                    isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        e.stopPropagation();
                        setSelectedIds(prev =>
                          e.target.checked
                            ? [...prev, b.id]
                            : prev.filter(id => id !== b.id)
                        );
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded accent-red-600 cursor-pointer"
                    />
                  </div>

                  {/* Row content — clicking opens the bug */}
                  <button
                    onClick={() => openBug(b)}
                    className={`w-full text-left py-3 pr-3 transition ${isChecked ? "pl-7" : "pl-3 group-hover:pl-7"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${p.dot} mt-1.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{b.title}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.bg} ${p.text}`}>
                            {p.label}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                            {s.label}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">{b.time_ago}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 truncate">{b.reporter.name}</p>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: bug detail */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {!selected && !detailLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="text-5xl mb-4">🐛</div>
              <p className="text-lg font-semibold text-gray-700">Select a bug report</p>
              <p className="text-sm text-gray-400 mt-1">Choose a bug from the list to see full details and activity.</p>
            </div>
          )}

          {detailLoading && (
            <div className="p-6 space-y-4">
              {[1,2].map(i => <div key={i} className="h-32 bg-white rounded-xl animate-pulse" />)}
            </div>
          )}

          {selected && !detailLoading && (() => {
            const p = PRIORITY_CONFIG[selected.priority];
            const s = STATUS_CONFIG[selected.status];
            return (
              <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">

                {/* ── Header card ─────────────────────────────────────────── */}
                <div className={`bg-white rounded-xl border-l-4 border border-gray-200 p-5 ${
                  selected.priority === "critical" ? "border-l-red-500" :
                  selected.priority === "high"     ? "border-l-orange-400" :
                  selected.priority === "medium"   ? "border-l-yellow-400" :
                  "border-l-gray-300"
                }`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h2 className="text-base font-bold text-gray-900 leading-snug">{selected.title}</h2>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.bg} ${p.text} flex items-center gap-1`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${p.dot}`} />
                        {p.label}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.bg} ${s.text}`}>
                        {s.label}
                      </span>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Reporter</p>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">
                          {initials(selected.reporter.name)}
                        </div>
                        <p className="font-medium text-gray-800 text-sm">{selected.reporter.name}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Assignee</p>
                      {selected.assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center">
                            {initials(selected.assignee.name)}
                          </div>
                          <p className="font-medium text-gray-800 text-sm">{selected.assignee.name}</p>
                        </div>
                      ) : (
                        <p className="text-gray-400 italic text-xs">Unassigned</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Reported</p>
                      <p className="text-gray-700 text-sm">{formatDateTime(selected.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Last updated</p>
                      <p className="text-gray-700 text-sm">{formatDateTime(selected.updated_at)}</p>
                    </div>
                  </div>

                  {selected.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {selected.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* ── Priority selector ───────────────────────────────── */}
                  {canWrite && (
                  <div className="border-t border-gray-100 pt-4 mb-4">
                    <p className="text-xs text-gray-400 font-medium mb-2">Priority</p>
                    <div className="flex gap-1.5">
                      {(["critical", "high", "medium", "low"] as const).map(lvl => {
                        const cfg = PRIORITY_CONFIG[lvl];
                        const isActive = selected.priority === lvl;
                        return (
                          <button
                            key={lvl}
                            onClick={() => !isActive && setPriority(lvl)}
                            disabled={isActive || actionLoading === "priority"}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                              isActive
                                ? `${cfg.activeBg} border-transparent shadow-sm`
                                : `bg-white ${cfg.text} ${cfg.border} hover:${cfg.bg} disabled:opacity-50`
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                            {isActive && " ✓"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  )}

                  {/* ── Status actions ───────────────────────────────────── */}
                  {canWrite && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 font-medium mb-2">Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {selected.status !== "in_progress" && selected.status !== "closed" && (
                        <button
                          onClick={() => setStatus("in_progress")}
                          disabled={actionLoading === "status"}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {actionLoading === "status" && (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          )}
                          Mark In Progress
                        </button>
                      )}
                      {selected.status !== "closed" && (
                        <button
                          onClick={() => setStatus("closed")}
                          disabled={actionLoading === "status"}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {actionLoading === "status" && (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          )}
                          Mark Resolved
                        </button>
                      )}
                      {selected.status === "closed" && (
                        <button
                          onClick={() => setStatus("open")}
                          disabled={actionLoading === "status"}
                          className="px-3 py-1.5 text-xs bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                      {selected.status === "in_progress" && (
                        <button
                          onClick={() => setStatus("open")}
                          disabled={actionLoading === "status"}
                          className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Back to Open
                        </button>
                      )}

                      {/* Assign button + modal */}
                      <div className="relative">
                        <button
                          onClick={() => { setShowAssignModal(v => !v); setAssignEmail(""); }}
                          className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                        >
                          {selected.assignee ? "Reassign" : "Assign"}
                        </button>
                        {showAssignModal && (
                          <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-3 w-64">
                            <p className="text-xs font-medium text-gray-700 mb-2">Assign to agent</p>
                            <input
                              autoFocus
                              type="email"
                              placeholder="agent@wesupport.com.au"
                              value={assignEmail}
                              onChange={e => setAssignEmail(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") assignBug();
                                if (e.key === "Escape") setShowAssignModal(false);
                              }}
                              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 mb-2"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={assignBug}
                                disabled={!assignEmail.trim() || actionLoading === "assign"}
                                className="flex-1 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
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
                    </div>
                  </div>
                  )}
                </div>

                {/* ── Description ─────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Description</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.description}</p>
                </div>

                {/* ── Tags ─────────────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Tags</h3>
                  <TagPicker channel="luciq" externalId={selected.id} />
                </div>

                {/* ── Activity / Comments ──────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    Activity
                    {selected.comments.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {selected.comments.length}
                      </span>
                    )}
                  </h3>

                  {selected.comments.length === 0 ? (
                    <p className="text-sm text-gray-400 italic mb-4">No activity yet.</p>
                  ) : (
                    <div className="space-y-4 mb-4">
                      {selected.comments.map(c => (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {initials(c.from.name)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-800">{c.from.name}</span>
                              {c.is_internal && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                                  Internal note
                                </span>
                              )}
                              <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap leading-relaxed px-3 py-2.5 rounded-lg ${
                              c.is_internal ? "bg-yellow-50 border border-yellow-100 text-gray-700" : "bg-gray-50 text-gray-700"
                            }`}>
                              {c.body}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Add comment ─────────────────────────────────────── */}
                  {canWrite && (
                  <div className={`rounded-xl border transition-shadow focus-within:ring-2 ${
                    commentInternal ? "border-yellow-200 focus-within:ring-yellow-300 bg-yellow-50/50" : "border-gray-200 focus-within:ring-gray-300 bg-white"
                  }`}>
                    <textarea
                      ref={commentInputRef}
                      value={commentBody}
                      onChange={e => setCommentBody(e.target.value)}
                      onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") postComment(); }}
                      placeholder={commentInternal ? "Add an internal note (only visible to agents)…" : "Add a comment…"}
                      rows={3}
                      className="w-full px-3 py-3 text-sm bg-transparent border-0 resize-none focus:outline-none rounded-t-xl placeholder-gray-400"
                    />
                    <div className="flex items-center justify-between px-3 pb-2.5">
                      {/* Internal toggle */}
                      <button
                        onClick={() => setCommentInternal(v => !v)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition font-medium border ${
                          commentInternal
                            ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span>{commentInternal ? "🔒" : "💬"}</span>
                        {commentInternal ? "Internal note" : "Public comment"}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300">⌘↵ to post</span>
                        <button
                          onClick={postComment}
                          disabled={!commentBody.trim() || commentPosting}
                          className="px-4 py-1.5 text-xs bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {commentPosting && (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          )}
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

              </div>
            );
          })()}
        </div>
      </div>

      {/* BulkActionBar — rendered outside the main layout so it floats above everything */}
      <BulkActionBar
        selectedIds={selectedIds}
        channel="luciq"
        onClear={() => setSelectedIds([])}
        onDone={fetchBugs}
      />
    </div>
  );
}
