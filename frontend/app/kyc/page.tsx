"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useToast } from "../../components/Toast";
import { useWebSocket } from "../../components/WebSocketContext";
import { useCanWrite } from "../../components/RoleGate";
import CustomerPanel from "../../components/CustomerPanel";
import CollisionBanner from "../../components/CollisionBanner";
import SlaIndicator from "../../components/SlaIndicator";
import SnoozeButton from "../../components/SnoozeButton";
import InternalNotes from "../../components/InternalNotes";
import KycDocuments from "../../components/KycDocuments";
import KycChecklist from "../../components/KycChecklist";
import KycAuditTimeline from "../../components/KycAuditTimeline";
import BulkActionBar from "../../components/BulkActionBar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

type KycStatus = "pending" | "in_review" | "approved" | "rejected" | "escalated";
type RiskLevel = "low" | "medium" | "high";

interface KycCase {
  id: string;
  customerName: string;
  customerEmail: string;
  customerId: string | null;
  status: KycStatus;
  riskLevel: RiskLevel;
  isPriority: boolean;
  assigneeId: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  gmailThreadId: string | null;
  rejectionReason: string | null;
  checklist: Record<string, boolean | null> | null;
  reviewedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { documents: number };
}

interface KycDocument {
  id: string;
  caseId: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  status: "pending" | "accepted" | "rejected";
  reviewNote: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

interface KycCaseDetail extends KycCase {
  documents: KycDocument[];
  auditLogs: any[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<KycStatus, string> = {
  pending: "Pending",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

const STATUS_BADGE: Record<KycStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  escalated: "bg-orange-100 text-orange-800",
};

const STATUS_RING: Record<KycStatus | "all", string> = {
  all: "border-gray-400 text-gray-700",
  pending: "border-yellow-400 text-yellow-700",
  in_review: "border-blue-400 text-blue-700",
  approved: "border-green-400 text-green-700",
  rejected: "border-red-400 text-red-700",
  escalated: "border-orange-400 text-orange-700",
};

const RISK_DOT: Record<RiskLevel, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-400",
  low: "bg-green-500",
};

const RISK_BADGE: Record<RiskLevel, string> = {
  high: "bg-red-50 text-red-700 border border-red-200",
  medium: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  low: "bg-green-50 text-green-700 border border-green-200",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const REJECTION_REASONS = [
  "Identity document expired",
  "Identity document unclear or unreadable",
  "Address document older than 3 months",
  "Name mismatch between documents",
  "Face does not match identity document",
  "Document suspected to be fraudulent",
  "Insufficient documentation provided",
  "Politically exposed person (PEP) – requires manual review",
  "Sanctions list match",
  "Customer did not complete verification within the allowed period",
];

const ALL_TABS: Array<{ key: KycStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_review", label: "In Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "escalated", label: "Escalated" },
];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
      <svg
        className="w-16 h-16 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
      <div>
        <p className="text-base font-semibold text-gray-600">Select a case to begin review</p>
        <p className="text-sm text-gray-400 mt-1">
          Choose a KYC case from the list on the left
        </p>
      </div>
    </div>
  );
}

// ─── Rejection Modal ──────────────────────────────────────────────────────────

interface RejectModalProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function RejectModal({ onConfirm, onCancel, loading }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Reject this KYC case</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
            >
              <option value="">Select a reason…</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Additional details{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Any further notes for the customer file…"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(detail ? `${reason} — ${detail}` : reason)}
            disabled={!reason || loading}
            className="text-sm px-4 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KycPage() {
  const { toast } = useToast();
  const { subscribe, unsubscribe, on, off } = useWebSocket();
  const canWrite = useCanWrite();

  const [cases, setCases] = useState<KycCase[]>([]);
  const [selected, setSelected] = useState<KycCaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<KycStatus | "all">("pending");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"documents" | "notes" | "audit">("documents");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeTab !== "all") params.status = activeTab;
      if (riskFilter !== "all") params.riskLevel = riskFilter;
      if (search.trim()) params.search = search.trim();

      const res = await axios.get(`${API}/api/kyc/cases`, { params });
      const data = res.data;
      setCases(Array.isArray(data.cases) ? data.cases : Array.isArray(data) ? data : []);
      if (data.counts) setStatusCounts(data.counts);
    } catch {
      // silently ignore — API may not be available yet
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, riskFilter, search]);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await axios.get(`${API}/api/kyc/cases/${id}`);
      setSelected(res.data as KycCaseDetail);
    } catch {
      toast("Failed to load case details", "error");
    }
  }, [toast]);

  const refreshDetail = useCallback(() => {
    if (selected) fetchDetail(selected.id);
  }, [selected, fetchDetail]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── WebSocket subscriptions ────────────────────────────────────────────────

  useEffect(() => {
    subscribe("kyc");
    return () => unsubscribe("kyc");
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    function handleStatusChanged(data: { caseId?: string }) {
      fetchList();
      if (selected && data?.caseId === selected.id) {
        fetchDetail(selected.id);
      }
    }
    function handleCaseCreated() {
      fetchList();
    }

    on("kyc:status_changed", handleStatusChanged);
    on("kyc:case_created", handleCaseCreated);
    return () => {
      off("kyc:status_changed", handleStatusChanged);
      off("kyc:case_created", handleCaseCreated);
    };
  }, [on, off, fetchList, fetchDetail, selected]);

  // ── Case selection ─────────────────────────────────────────────────────────

  async function openCase(kcase: KycCase) {
    setDetailTab("documents");
    await fetchDetail(kcase.id);
  }

  // ── Multi-select ───────────────────────────────────────────────────────────

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Status patch helper ────────────────────────────────────────────────────

  async function patchStatus(
    status: KycStatus,
    extra?: { rejectionReason?: string }
  ) {
    if (!selected || actionLoading) return;
    setActionLoading(status);
    try {
      await axios.patch(`${API}/api/kyc/cases/${selected.id}/status`, {
        status,
        ...extra,
      });
      toast(
        status === "approved"
          ? "Case approved"
          : status === "rejected"
          ? "Case rejected"
          : status === "escalated"
          ? "Case escalated"
          : status === "in_review"
          ? "Case moved to In Review"
          : "Status updated"
      );
      await fetchDetail(selected.id);
      fetchList();
    } catch {
      toast("Failed to update status", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConfirmReject(reason: string) {
    setRejectLoading(true);
    try {
      await patchStatus("rejected", { rejectionReason: reason });
      setShowRejectModal(false);
    } finally {
      setRejectLoading(false);
    }
  }

  function handleChecklistUpdate(updated: Record<string, boolean | null>) {
    setSelected((prev) => (prev ? { ...prev, checklist: updated } : prev));
  }

  // ── Render: action buttons ─────────────────────────────────────────────────

  function renderActionButtons() {
    if (!selected || !canWrite) return null;

    const btnBase =
      "text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 disabled:opacity-50";

    const spinner = (key: string) =>
      actionLoading === key ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null;

    if (selected.status === "pending") {
      return (
        <button
          onClick={() => patchStatus("in_review")}
          disabled={!!actionLoading}
          className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
        >
          {spinner("in_review")}
          Start Review →
        </button>
      );
    }

    if (selected.status === "in_review" || selected.status === "escalated") {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => patchStatus("approved")}
            disabled={!!actionLoading}
            className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
          >
            {spinner("approved")}
            ✓ Approve
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={!!actionLoading}
            className={`${btnBase} bg-red-600 text-white hover:bg-red-700`}
          >
            ✗ Reject
          </button>
          {selected.status === "in_review" ? (
            <button
              onClick={() => patchStatus("escalated")}
              disabled={!!actionLoading}
              className={`${btnBase} bg-amber-500 text-white hover:bg-amber-600`}
            >
              {spinner("escalated")}
              ↑ Escalate
            </button>
          ) : (
            <button
              onClick={() => patchStatus("in_review")}
              disabled={!!actionLoading}
              className={`${btnBase} bg-gray-200 text-gray-700 hover:bg-gray-300`}
            >
              {spinner("in_review")}
              ← Return to Review
            </button>
          )}
        </div>
      );
    }

    // approved / rejected — no action buttons
    return (
      <div className="text-xs text-gray-400">
        {selected.completedAt
          ? `Completed ${formatDate(selected.completedAt)}`
          : selected.reviewedAt
          ? `Reviewed ${formatDate(selected.reviewedAt)}`
          : null}
        {selected.assignee && (
          <span className="ml-2">
            by{" "}
            <span className="font-medium text-gray-600">
              {selected.assignee.name || selected.assignee.email}
            </span>
          </span>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      {/* ── Top bar ── */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-lg select-none">
            🔐
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">KYC Review</h1>
            <p className="text-xs text-gray-400">Verification case management pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${API}/api/export/kyc`}
            download
            className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            ↓ Export CSV
          </a>
          <button
            onClick={() =>
              alert(
                "Use the KYC intake form to create cases.\n\nThis pipeline manages existing cases submitted through the onboarding flow."
              )
            }
            className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5"
          >
            <span className="text-sm leading-none">+</span>
            New Case
          </button>
        </div>
      </div>

      {/* ── Three-panel body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT PANEL ─── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">

          {/* Tab strip */}
          <div className="flex border-b border-gray-100 px-1 overflow-x-auto scrollbar-thin flex-shrink-0">
            {ALL_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count =
                tab.key === "all"
                  ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
                  : statusCounts[tab.key] ?? 0;

              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelected(null);
                    setSelectedIds([]);
                  }}
                  className={`flex-shrink-0 px-2.5 py-2.5 text-xs font-medium transition whitespace-nowrap border-b-2 ${
                    isActive
                      ? `${STATUS_RING[tab.key]} border-current`
                      : "text-gray-500 border-transparent hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        isActive ? "bg-current/10" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Risk filter chips */}
          <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 flex-shrink-0 flex-wrap">
            {(
              [
                { key: "all", label: "All" },
                { key: "high", label: "🔴 High" },
                { key: "medium", label: "🟡 Med" },
                { key: "low", label: "🟢 Low" },
              ] as { key: RiskLevel | "all"; label: string }[]
            ).map((chip) => (
              <button
                key={chip.key}
                onClick={() => setRiskFilter(chip.key)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition border ${
                  riskFilter === chip.key
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path d="M21 21l-4.35-4.35" strokeWidth={2} strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Case list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : cases.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No cases found
              </div>
            ) : (
              cases.map((kcase) => {
                const isSelected = selected?.id === kcase.id;
                const isChecked = selectedIds.includes(kcase.id);
                const showCheckbox = isChecked || selectedIds.length > 0;

                return (
                  <button
                    key={kcase.id}
                    onClick={() => openCase(kcase)}
                    className={`w-full text-left px-3 py-3 border-b border-gray-50 transition group ${
                      isSelected
                        ? "bg-indigo-50 border-l-2 border-l-indigo-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      <div
                        className={`flex-shrink-0 mt-0.5 transition ${
                          showCheckbox ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                        onClick={(e) => toggleSelect(kcase.id, e)}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            isChecked
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isChecked && "✓"}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            {kcase.isPriority && (
                              <span className="text-yellow-500 text-xs flex-shrink-0" title="Priority">⭐</span>
                            )}
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {kcase.customerName}
                            </p>
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {timeAgo(kcase.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {kcase.customerEmail}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {/* Risk dot */}
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[kcase.riskLevel]}`}
                            title={`${RISK_LABELS[kcase.riskLevel]} risk`}
                          />
                          {/* Status badge */}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[kcase.status]}`}
                          >
                            {STATUS_LABELS[kcase.status]}
                          </span>
                          {/* Doc count */}
                          {kcase._count.documents > 0 && (
                            <span className="text-[10px] text-gray-400">
                              {kcase._count.documents} doc{kcase._count.documents !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ─── MIDDLE PANEL ─── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {!selected ? (
            <EmptyState />
          ) : (
            <>
              {/* Case header */}
              <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-gray-900">
                        {selected.customerName}
                      </h2>
                      {selected.isPriority && (
                        <span title="Priority case" className="text-yellow-500">⭐</span>
                      )}
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_BADGE[selected.riskLevel]}`}
                      >
                        {RISK_LABELS[selected.riskLevel]} Risk
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[selected.status]}`}
                      >
                        {STATUS_LABELS[selected.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{selected.customerEmail}</p>
                    {selected.completedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Completed {formatDate(selected.completedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-3">{renderActionButtons()}</div>
              </div>

              {/* Collision banner */}
              <div className="flex-shrink-0 px-5 pt-3">
                <CollisionBanner channel="kyc" externalId={selected.id} />
              </div>

              {/* SLA + Snooze row */}
              <div className="flex-shrink-0 px-5 pb-2 flex items-center gap-3 flex-wrap">
                <SlaIndicator channel="kyc" externalId={selected.id} />
                <SnoozeButton channel="kyc" externalId={selected.id} />
              </div>

              {/* Sub-tab strip */}
              <div className="flex-shrink-0 flex border-b border-gray-200 bg-white px-5">
                {(
                  [
                    {
                      key: "documents" as const,
                      label: "Documents",
                      count: selected.documents?.length ?? selected._count.documents,
                    },
                    { key: "notes" as const, label: "Notes", count: null },
                    {
                      key: "audit" as const,
                      label: "Audit",
                      count: selected.auditLogs?.length ?? null,
                    },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                      detailTab === tab.key
                        ? "text-indigo-600 border-indigo-600"
                        : "text-gray-500 border-transparent hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                    {tab.count !== null && tab.count > 0 && (
                      <span
                        className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          detailTab === tab.key
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Sub-tab content + Checklist */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                {/* Sub-tab content */}
                {detailTab === "documents" && (
                  <KycDocuments
                    caseId={selected.id}
                    documents={selected.documents ?? []}
                    canWrite={canWrite}
                    onChanged={refreshDetail}
                  />
                )}
                {detailTab === "notes" && (
                  <InternalNotes channel="kyc" externalId={selected.id} />
                )}
                {detailTab === "audit" && (
                  <KycAuditTimeline caseId={selected.id} />
                )}

                {/* Checklist — always shown below sub-tab content */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Verification Checklist
                    </h4>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <KycChecklist
                    caseId={selected.id}
                    checklist={
                      selected.checklist as { id_verified: boolean | null; address_verified: boolean | null; face_match: boolean | null } | null
                    }
                    canWrite={canWrite}
                    onChanged={handleChecklistUpdate}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── RIGHT PANEL ─── */}
        {selected && (
          <CustomerPanel
            email={selected.customerEmail}
            name={selected.customerName}
          />
        )}
      </div>

      {/* ── Reject Modal ── */}
      {showRejectModal && (
        <RejectModal
          loading={rejectLoading}
          onConfirm={handleConfirmReject}
          onCancel={() => setShowRejectModal(false)}
        />
      )}

      {/* ── Bulk action bar ── */}
      <BulkActionBar
        selectedIds={selectedIds}
        channel="kyc"
        onClear={() => setSelectedIds([])}
        onDone={fetchList}
      />
    </div>
  );
}
