"use client";

import { useEffect, useState } from "react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type AuditAction =
  | "created"
  | "status_changed"
  | "document_uploaded"
  | "document_reviewed"
  | "assigned"
  | "checklist_updated"
  | "escalated"
  | string;

interface AuditAgent {
  id: string;
  name?: string | null;
  email: string;
}

interface AuditDetails {
  fromStatus?: string;
  toStatus?: string;
  fileName?: string;
  status?: string;
  [key: string]: unknown;
}

interface AuditEntry {
  id: string;
  caseId: string;
  action: AuditAction;
  agent: AuditAgent;
  details: AuditDetails | null;
  createdAt: string;
}

interface KycAuditTimelineProps {
  caseId: string;
}

function actionIcon(action: AuditAction): string {
  switch (action) {
    case "created":
      return "➕";
    case "status_changed":
      return "🔄";
    case "document_uploaded":
      return "📎";
    case "document_reviewed":
      return "🔍";
    case "assigned":
      return "👤";
    case "checklist_updated":
      return "✅";
    case "escalated":
      return "⬆️";
    default:
      return "📝";
  }
}

function actionDescription(action: AuditAction, details: AuditDetails | null): string {
  switch (action) {
    case "created":
      return "Created case";
    case "status_changed":
      if (details?.fromStatus && details?.toStatus) {
        return `Changed status from ${details.fromStatus} to ${details.toStatus}`;
      }
      return "Changed status";
    case "document_uploaded":
      if (details?.fileName) {
        return `Uploaded ${details.fileName}`;
      }
      return "Uploaded a document";
    case "document_reviewed":
      if (details?.status) {
        return `Marked document as ${details.status}`;
      }
      return "Reviewed a document";
    case "assigned":
      return "Assigned case";
    case "checklist_updated":
      return "Updated verification checklist";
    case "escalated":
      return "Escalated case";
    default:
      return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 items-start animate-pulse">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="w-px flex-1 min-h-[24px] bg-gray-100 mt-1" />
      </div>
      <div className="flex flex-col gap-1.5 pb-4 flex-1 pt-1">
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  );
}

export default function KycAuditTimeline({ caseId }: KycAuditTimelineProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    axios
      .get<AuditEntry[]>(`${API}/api/kyc/cases/${caseId}/audit`)
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res.data) ? res.data : [];
        // Newest first
        setEntries([...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load audit log.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Activity
        </h4>
        {!loading && entries.length > 0 && (
          <span className="text-[10px] text-gray-400">{entries.length} event{entries.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Timeline body */}
      <div className="max-h-80 overflow-y-auto pr-1 slim-scroll">
        {loading && (
          <div className="flex flex-col">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {!loading && error && (
          <p className="text-xs text-red-500 text-center py-4">{error}</p>
        )}

        {!loading && !error && entries.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No activity yet</p>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="flex flex-col">
            {entries.map((entry, idx) => {
              const isLast = idx === entries.length - 1;
              const agentName = entry.agent?.name || entry.agent?.email || "Unknown";
              const icon = actionIcon(entry.action);
              const description = actionDescription(entry.action, entry.details);
              const time = relativeTime(entry.createdAt);

              return (
                <div key={entry.id} className="flex gap-3 items-start">
                  {/* Icon column with connecting line */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-base leading-none select-none">
                      {icon}
                    </div>
                    {!isLast && (
                      <div className="w-px bg-gray-200 flex-1 min-h-[20px] mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div
                    className={`flex flex-col gap-0.5 pt-1 min-w-0 ${
                      isLast ? "pb-1" : "pb-4"
                    }`}
                  >
                    <p className="text-xs text-gray-800 leading-snug">
                      <span className="font-medium">{agentName}</span>{" "}
                      <span className="text-gray-600">{description}</span>
                    </p>
                    <p className="text-[10px] text-gray-400">{time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
