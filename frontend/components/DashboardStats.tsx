"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "./StatCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface DashboardStats {
  summary: {
    pendingEmails: number;
    openCases: number;
    repliedLast7Days: number;
    newLast7Days: number;
    activeBugs: number;
    resolvedLast7Days: number;
  };
  lastUpdated: string;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/dashboard/stats`);
      setStats(res.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, []);

  const s = stats?.summary;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Overview</h2>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-xs text-gray-400">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { setIsLoading(true); fetchStats(); }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Top row — primary action stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Pending Emails"
          value={s?.pendingEmails ?? null}
          icon="📬"
          color="amber"
          sublabel="Waiting for reply"
          isLoading={isLoading}
        />
        <StatCard
          label="Open Cases"
          value={s?.openCases ?? null}
          icon="💬"
          color="blue"
          sublabel="Across all channels"
          isLoading={isLoading}
        />
        <StatCard
          label="Replied (7 days)"
          value={s?.repliedLast7Days ?? null}
          icon="✅"
          color="green"
          sublabel="Agent responses sent"
          isLoading={isLoading}
        />
        <StatCard
          label="New (7 days)"
          value={s?.newLast7Days ?? null}
          icon="🆕"
          color="purple"
          sublabel="Conversations started"
          isLoading={isLoading}
        />
      </div>

      {/* Bottom row — secondary stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Active Bugs"
          value={s?.activeBugs ?? null}
          icon="🐛"
          color="red"
          sublabel="Open + in progress"
          isLoading={isLoading}
        />
        <StatCard
          label="Resolved (7 days)"
          value={s?.resolvedLast7Days ?? null}
          icon="🎯"
          color="indigo"
          sublabel="Cases closed this week"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
