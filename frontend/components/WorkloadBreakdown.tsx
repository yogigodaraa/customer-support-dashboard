"use client";

import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Breakdown {
  gmail: { pending: number; assigned: number; newLast7Days: number; repliedLast7Days: number };
  intercom: { open: number; newLast7Days: number; repliedLast7Days: number };
  luciq: { open: number; inProgress: number; newLast7Days: number };
}

function Row({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-800 w-8 text-right">{value}</span>
    </div>
  );
}

export default function WorkloadBreakdown() {
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/dashboard/stats`)
      .then((res) => setBreakdown(res.data.breakdown))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Workload Breakdown</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!breakdown) return null;

  const gmailMax = Math.max(breakdown.gmail.pending, breakdown.gmail.assigned, breakdown.gmail.newLast7Days, 1);
  const intercomMax = Math.max(breakdown.intercom.open, breakdown.intercom.newLast7Days, 1);
  const luciqMax = Math.max(breakdown.luciq.open, breakdown.luciq.inProgress, breakdown.luciq.newLast7Days, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Workload Breakdown</h3>

      {/* Email (Gmail) */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <span>📧</span> Email
        </p>
        <div className="space-y-2">
          <Row label="Pending" value={breakdown.gmail.pending} max={gmailMax} />
          <Row label="Assigned" value={breakdown.gmail.assigned} max={gmailMax} />
          <Row label="New (7d)" value={breakdown.gmail.newLast7Days} max={gmailMax} />
          <Row label="Replied (7d)" value={breakdown.gmail.repliedLast7Days} max={Math.max(breakdown.gmail.repliedLast7Days, gmailMax)} />
        </div>
      </div>

      {/* Intercom */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <span>💬</span> Intercom
        </p>
        <div className="space-y-2">
          <Row label="Open" value={breakdown.intercom.open} max={intercomMax} />
          <Row label="New (7d)" value={breakdown.intercom.newLast7Days} max={intercomMax} />
          <Row label="Replied (7d)" value={breakdown.intercom.repliedLast7Days} max={Math.max(breakdown.intercom.repliedLast7Days, intercomMax)} />
        </div>
      </div>

      {/* Luciq */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <span>🐛</span> Luciq Bugs
        </p>
        <div className="space-y-2">
          <Row label="Open" value={breakdown.luciq.open} max={luciqMax} />
          <Row label="In Progress" value={breakdown.luciq.inProgress} max={luciqMax} />
          <Row label="New (7d)" value={breakdown.luciq.newLast7Days} max={luciqMax} />
        </div>
      </div>
    </div>
  );
}
