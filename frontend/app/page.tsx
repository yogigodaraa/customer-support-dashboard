"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import AreaChart from "@/components/charts/AreaChart";
import DonutChart from "@/components/charts/DonutChart";
import HBarChart from "@/components/charts/HBarChart";
import SparkLine from "@/components/charts/SparkLine";
import SearchBar from "@/components/SearchBar";
import SearchResults from "@/components/SearchResults";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DailyPoint { day: string; date: string; gmail: number; intercom: number; luciq: number; total: number }
interface AgentStat { agentId: string; agentName: string; agentEmail: string; noteCount: number; kycCasesReviewed: number }
interface CsatSummary { avgScore: number | null; responseRate: number; totalSent: number; totalResponded: number; scoreDistribution: number[] }

interface DashboardData {
  summary: {
    pendingEmails: number; openCases: number; repliedLast7Days: number;
    newLast7Days: number; activeBugs: number; resolvedLast7Days: number;
    unassignedKyc: number;
    trends: { pendingEmails: number; openCases: number; repliedLast7Days: number; newLast7Days: number };
  };
  breakdown: {
    gmail: { pending: number; assigned: number; newLast7Days: number; repliedLast7Days: number };
    intercom: { open: number; newLast7Days: number; repliedLast7Days: number };
    luciq: { open: number; inProgress: number; newLast7Days: number };
  };
  dailyTrend: DailyPoint[];
  responseTimes: { gmail: number; intercom: number; luciq: number };
  tagBreakdown: Array<{ tag: string; count: number; color: string }>;
  slaHealth: { onTime: number; atRisk: number; breached: number };
  agentStats: AgentStat[];
  heatmap: number[];
  csatSummary: CsatSummary;
  lastUpdated: string;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | null;
  icon: string;
  trend?: number; // % change
  sparkData?: number[];
  sparkColor?: string;
  accentClass: string;
  href?: string;
  sublabel?: string;
}

function StatCard({ label, value, icon, trend, sparkData, sparkColor = "#3B82F6", accentClass, href, sublabel }: StatCardProps) {
  const isUp = trend !== undefined && trend >= 0;
  const inner = (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow group`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${accentClass}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            isUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
          }`}>
            {isUp ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          {value === null ? (
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mb-1" />
          ) : (
            <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">{label}</p>
          {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
        </div>
        {sparkData && (
          <div className="opacity-70 group-hover:opacity-100 transition-opacity">
            <SparkLine data={sparkData} color={sparkColor} width={72} height={32} />
          </div>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-700 mb-3">{children}</h2>;
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── SLA health bar ────────────────────────────────────────────────────────────

function SlaBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-2.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-800 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [period, setPeriod] = useState<"7days" | "30days" | "90days">("7days");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [kycStats, setKycStats] = useState<{
    pendingCount: number;
    inReviewCount: number;
    approvedToday: number;
    rejectedToday: number;
    avgVerificationHours: number;
    approvalRate: number;
    rejectionReasons: { reason: string; count: number }[];
    volumeTrend: { date: string; count: number }[];
  } | null>(null);

  const downloadExport = useCallback(async (type: string, filename: string) => {
    setExportingType(type);
    try {
      const token = localStorage.getItem("ws_token");
      const res = await fetch(`${API}/api/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally {
      setExportingType(null);
      setExportOpen(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [dashRes, kycRes] = await Promise.all([
        axios.get(`${API}/api/dashboard/stats`, { params: { period } }),
        axios.get(`${API}/api/kyc/stats`).catch(() => ({ data: null })),
      ]);
      setData(dashRes.data);
      setKycStats(kycRes.data);
      setLastRefresh(new Date());
    } catch { /* silently ignore */ }
  }, [period]);

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 60_000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  const handleSearch = async (email?: string, userId?: string) => {
    if (!email && !userId) return;
    setSearchLoading(true);
    try {
      const res = await axios.post(`${API}/api/search`, { email, userId });
      setSearchResults(res.data);
    } catch { /* silently ignore */ }
    finally { setSearchLoading(false); }
  };

  const s = data?.summary;
  const b = data?.breakdown;

  // Sparkline data derived from daily trend (last 7 days per channel)
  const gmailSpark    = data?.dailyTrend.map(d => d.gmail)    ?? [];
  const intercomSpark = data?.dailyTrend.map(d => d.intercom) ?? [];
  const totalSpark    = data?.dailyTrend.map(d => d.total)    ?? [];
  const luciqSpark    = data?.dailyTrend.map(d => d.luciq)    ?? [];

  // Donut segments
  const channelSegments = b ? [
    { label: "Email",    value: b.gmail.pending + b.gmail.assigned,    color: "#3B82F6" },
    { label: "Intercom", value: b.intercom.open,                        color: "#8B5CF6" },
    { label: "Luciq",    value: b.luciq.open + b.luciq.inProgress,     color: "#EF4444" },
  ] : [];

  const slaSegments = data ? [
    { label: "On time",  value: data.slaHealth.onTime,   color: "#10B981" },
    { label: "At risk",  value: data.slaHealth.atRisk,   color: "#F59E0B" },
    { label: "Breached", value: data.slaHealth.breached, color: "#EF4444" },
  ] : [];

  const responseBarData = data ? [
    { label: "Email",    value: data.responseTimes.gmail,    color: "#3B82F6" },
    { label: "Intercom", value: data.responseTimes.intercom, color: "#8B5CF6" },
    { label: "Luciq",    value: data.responseTimes.luciq,    color: "#EF4444" },
  ] : [];

  const tagBarData = (data?.tagBreakdown ?? []).map(t => ({
    label: t.tag,
    value: t.count,
    color: t.color,
  }));

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-400">
            Last updated {lastRefresh.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period picker */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(["7days", "30days", "90days"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 transition ${period === p ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                {p === "7days" ? "7D" : p === "30days" ? "30D" : "90D"}
              </button>
            ))}
          </div>

          {/* Export dropdown */}
          <div className="relative">
            <button onClick={() => setExportOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              ↓ Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {[
                  { label: "Conversations CSV", type: "conversations", file: "conversations.csv" },
                  { label: "SLA Report CSV",    type: "sla-report",    file: "sla-report.csv" },
                  { label: "KYC Cases CSV",     type: "kyc-cases",     file: "kyc-cases.csv" },
                ].map(opt => (
                  <button key={opt.type}
                    onClick={() => downloadExport(opt.type, opt.file)}
                    disabled={exportingType === opt.type}
                    className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2 disabled:opacity-50">
                    {exportingType === opt.type
                      ? <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      : "↓"}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={fetchStats} title="Refresh"
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            ↻
          </button>
          <button onClick={() => { setSearchOpen(v => !v); setSearchResults(null); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition">
            🔍 Search customer
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-screen-xl mx-auto">

        {/* ── Search panel ───────────────────────────────────────────────────── */}
        {searchOpen && (
          <Card>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Search customer</h2>
            <SearchBar onSearch={handleSearch} isLoading={searchLoading} />
            {searchResults && <div className="mt-4"><SearchResults results={searchResults} query="" /></div>}
            {!searchResults && !searchLoading && (
              <p className="text-xs text-gray-400 mt-2">Enter email or user ID to look up a customer across all platforms.</p>
            )}
          </Card>
        )}

        {/* ── Stat cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Open Cases"
            value={s?.openCases ?? null}
            icon="📬"
            trend={s?.trends.openCases}
            sparkData={totalSpark}
            sparkColor="#3B82F6"
            accentClass="bg-blue-50"
            href="/gmail"
            sublabel="Email + Intercom"
          />
          <StatCard
            label="Pending Emails"
            value={s?.pendingEmails ?? null}
            icon="📧"
            trend={s?.trends.pendingEmails}
            sparkData={gmailSpark}
            sparkColor="#F59E0B"
            accentClass="bg-amber-50"
            href="/gmail"
            sublabel="Unassigned emails"
          />
          <StatCard
            label="Replied (7 days)"
            value={s?.repliedLast7Days ?? null}
            icon="✓"
            trend={s?.trends.repliedLast7Days}
            sparkData={intercomSpark.map((v, i) => v + (gmailSpark[i] ?? 0))}
            sparkColor="#10B981"
            accentClass="bg-green-50"
            sublabel="Across all channels"
          />
          <StatCard
            label="Active Bugs"
            value={s?.activeBugs ?? null}
            icon="🐛"
            sparkData={luciqSpark}
            sparkColor="#EF4444"
            accentClass="bg-red-50"
            href="/luciq"
            sublabel={b ? `${b.luciq.inProgress} in progress` : undefined}
          />
        </div>

        {/* ── Charts row 1: Volume + Channel breakdown ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <SectionTitle>Conversation Volume — Last 7 Days</SectionTitle>
              <span className="text-xs text-gray-400">
                {data ? `${data.summary.newLast7Days} new total` : ""}
              </span>
            </div>
            {data ? (
              <AreaChart data={data.dailyTrend} height={188} />
            ) : (
              <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
            )}
          </Card>

          <Card>
            <SectionTitle>Open Tickets by Channel</SectionTitle>
            {data ? (
              <div className="flex items-center justify-center mt-2">
                <DonutChart segments={channelSegments} size={148} thickness={28} />
              </div>
            ) : (
              <div className="h-40 bg-gray-50 rounded-xl animate-pulse" />
            )}
            {/* Quick links */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
              {[
                { label: "Email",    href: "/gmail",    color: "text-blue-600",   bg: "bg-blue-50",   val: b ? b.gmail.pending + b.gmail.assigned : "—" },
                { label: "Intercom", href: "/intercom", color: "text-purple-600", bg: "bg-purple-50", val: b ? b.intercom.open : "—" },
                { label: "Luciq",    href: "/luciq",    color: "text-red-600",    bg: "bg-red-50",    val: b ? b.luciq.open + b.luciq.inProgress : "—" },
              ].map(c => (
                <Link
                  key={c.label}
                  href={c.href}
                  className={`${c.bg} ${c.color} rounded-lg p-2 text-center hover:opacity-80 transition`}
                >
                  <p className="text-lg font-bold">{c.val}</p>
                  <p className="text-xs">{c.label}</p>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Charts row 2: Response times + Tags + SLA ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Response time */}
          <Card>
            <SectionTitle>Avg First Response Time</SectionTitle>
            {data ? (
              <>
                <HBarChart
                  bars={responseBarData}
                  valueFormatter={v => `${v}h`}
                  maxValue={24}
                />
                <p className="text-xs text-gray-400 mt-3">
                  Industry benchmark: &lt;4h for email, &lt;2h for chat
                </p>
                {/* Benchmark indicator */}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {data.responseTimes.intercom <= 2 ? (
                    <span className="text-green-600 font-medium">✓ Intercom on target</span>
                  ) : (
                    <span className="text-amber-600 font-medium">⚠ Intercom above target</span>
                  )}
                  {data.responseTimes.gmail <= 4 ? (
                    <span className="text-green-600 font-medium">✓ Email on target</span>
                  ) : (
                    <span className="text-amber-600 font-medium">⚠ Email above target</span>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)}
              </div>
            )}
          </Card>

          {/* Top tags */}
          <Card>
            <SectionTitle>Top Issue Categories</SectionTitle>
            {data ? (
              <HBarChart
                bars={tagBarData}
                maxValue={tagBarData[0]?.value ?? 1}
              />
            ) : (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)}
              </div>
            )}
          </Card>

          {/* SLA health */}
          <Card>
            <SectionTitle>SLA Health</SectionTitle>
            {data ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <DonutChart segments={slaSegments} size={128} thickness={24} />
                </div>
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <SlaBar label="On time"  pct={data.slaHealth.onTime}   color="#10B981" />
                  <SlaBar label="At risk"  pct={data.slaHealth.atRisk}   color="#F59E0B" />
                  <SlaBar label="Breached" pct={data.slaHealth.breached} color="#EF4444" />
                </div>
                {data.slaHealth.breached > 0 && (
                  <p className="text-xs text-red-500 font-medium mt-3">
                    ⚠ {data.slaHealth.breached}% of tickets have breached SLA
                  </p>
                )}
              </>
            ) : (
              <div className="h-40 bg-gray-50 rounded-xl animate-pulse" />
            )}
          </Card>
        </div>

        {/* ── Bottom row: Platform deep-dive cards ──────────────────────────── */}
        <div>
          <SectionTitle>Platform Overview</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Email (Gmail) */}
            <Link href="/gmail">
              <Card className="hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-base">📧</div>
                    <span className="font-semibold text-gray-900">Email</span>
                  </div>
                  <span className="text-xs text-blue-600 group-hover:underline">View all →</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Pending",     value: b?.gmail.pending,        color: "text-amber-600" },
                    { label: "Assigned",    value: b?.gmail.assigned,       color: "text-blue-600" },
                    { label: "New (7d)",    value: b?.gmail.newLast7Days,   color: "text-gray-700" },
                    { label: "Replied (7d)",value: b?.gmail.repliedLast7Days, color: "text-green-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className={`text-xl font-bold ${color}`}>{value ?? "—"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {b && (
                  <div className="mt-3">
                    <SparkLine data={gmailSpark} color="#3B82F6" width={220} height={28} />
                  </div>
                )}
              </Card>
            </Link>

            {/* Intercom */}
            <Link href="/intercom">
              <Card className="hover:border-purple-200 hover:shadow-md transition-all group cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-base">💬</div>
                    <span className="font-semibold text-gray-900">Intercom</span>
                  </div>
                  <span className="text-xs text-purple-600 group-hover:underline">View all →</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Open",        value: b?.intercom.open,             color: "text-purple-600" },
                    { label: "New (7d)",    value: b?.intercom.newLast7Days,     color: "text-gray-700" },
                    { label: "Replied (7d)",value: b?.intercom.repliedLast7Days, color: "text-green-600" },
                    { label: "Avg reply",   value: data ? `${data.responseTimes.intercom}h` : "—", color: "text-blue-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className={`text-xl font-bold ${color}`}>{value ?? "—"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {b && (
                  <div className="mt-3">
                    <SparkLine data={intercomSpark} color="#8B5CF6" width={220} height={28} />
                  </div>
                )}
              </Card>
            </Link>

            {/* Luciq */}
            <Link href="/luciq">
              <Card className="hover:border-red-200 hover:shadow-md transition-all group cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-base">🐛</div>
                    <span className="font-semibold text-gray-900">Luciq</span>
                  </div>
                  <span className="text-xs text-red-600 group-hover:underline">View all →</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Open",       value: b?.luciq.open,        color: "text-red-600" },
                    { label: "In Progress",value: b?.luciq.inProgress,  color: "text-blue-600" },
                    { label: "New (7d)",   value: b?.luciq.newLast7Days,color: "text-gray-700" },
                    { label: "Resolved (7d)", value: s?.resolvedLast7Days, color: "text-green-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className={`text-xl font-bold ${color}`}>{value ?? "—"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {b && (
                  <div className="mt-3">
                    <SparkLine data={luciqSpark} color="#EF4444" width={220} height={28} />
                  </div>
                )}
              </Card>
            </Link>

          </div>
        </div>

        {/* ── KYC Verification Section ────────────────────────────────────── */}
        {kycStats && (
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              🔐 KYC Verification
            </h2>

            {/* 4 stat cards: Pending, In Review, Approved Today, Rejection Rate */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Pending Review", value: kycStats.pendingCount, color: "text-yellow-600", bg: "bg-yellow-50" },
                { label: "In Review", value: kycStats.inReviewCount, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Approved Today", value: kycStats.approvedToday, color: "text-green-600", bg: "bg-green-50" },
                { label: "Rejected Today", value: kycStats.rejectedToday, color: "text-red-600", bg: "bg-red-50" },
              ].map(card => (
                <div key={card.label} className={`${card.bg} rounded-2xl p-4`}>
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color} mt-1`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* 2-column: Approval rate + Avg time | Rejection reasons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Approval Rate (30 days)</p>
                {/* Reuse DonutChart if imported; else a simple progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full" style={{ width: `${kycStats.approvalRate}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{kycStats.approvalRate}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-3">Avg review time: <span className="font-medium text-gray-700">{kycStats.avgVerificationHours}h</span></p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Top Rejection Reasons</p>
                <div className="space-y-2">
                  {(kycStats.rejectionReasons.slice(0, 5)).map(r => (
                    <div key={r.reason} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate text-gray-700">{r.reason}</span>
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{r.count}</span>
                    </div>
                  ))}
                  {kycStats.rejectionReasons.length === 0 && (
                    <p className="text-xs text-gray-400">No rejections yet</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── CSAT + Unassigned KYC + Per-Agent table ──────────────────────── */}
        {data && (
          <section>
            <SectionTitle>Team Performance</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* CSAT summary card */}
              <Card>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">CSAT Score</p>
                {data.csatSummary.totalSent === 0 ? (
                  <p className="text-xs text-gray-400">No surveys sent yet</p>
                ) : (
                  <>
                    <div className="flex items-end gap-2 mb-3">
                      <p className="text-3xl font-bold text-gray-900">
                        {data.csatSummary.avgScore !== null ? data.csatSummary.avgScore.toFixed(1) : "—"}
                      </p>
                      <p className="text-sm text-gray-400 mb-1">/ 5</p>
                      <span className="ml-auto text-xs text-gray-400">{data.csatSummary.responseRate}% response rate</span>
                    </div>
                    <div className="flex items-end gap-0.5 h-10">
                      {data.csatSummary.scoreDistribution.map((count, i) => {
                        const max = Math.max(...data.csatSummary.scoreDistribution, 1);
                        const colors = ["#EF4444","#F97316","#F59E0B","#84CC16","#22C55E"];
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full rounded-sm transition-all" style={{ height: `${Math.max(4, (count / max) * 36)}px`, background: colors[i] }} title={`${i+1}★: ${count}`} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1★</span><span>5★</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{data.csatSummary.totalResponded} of {data.csatSummary.totalSent} responded</p>
                  </>
                )}
              </Card>

              {/* Unassigned KYC card */}
              <Card>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Unassigned KYC Cases</p>
                <p className="text-4xl font-bold text-amber-500 mb-1">{data.summary.unassignedKyc}</p>
                <p className="text-xs text-gray-400">Pending or in-review KYC cases with no assignee</p>
                <Link href="/kyc" className="mt-3 inline-block text-xs text-blue-600 hover:underline">View KYC cases →</Link>
              </Card>

              {/* Busiest hours mini heatmap */}
              <Card>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Volume by Hour</p>
                <div className="flex items-end gap-px h-12">
                  {data.heatmap.map((v, h) => {
                    const max = Math.max(...data.heatmap, 1);
                    const pct = v / max;
                    const color = pct > 0.7 ? "#EF4444" : pct > 0.4 ? "#F59E0B" : pct > 0.1 ? "#3B82F6" : "#E5E7EB";
                    return (
                      <div key={h} className="flex-1" style={{ height: `${Math.max(2, pct * 48)}px`, background: color, borderRadius: "1px" }} title={`${h}:00 — ${v} conversations`} />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>12am</span><span>12pm</span><span>11pm</span>
                </div>
              </Card>
            </div>

            {/* Per-agent performance table */}
            {data.agentStats.length > 0 && (
              <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Agent Performance</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-50">
                      <th className="px-5 py-2.5 text-xs font-medium text-gray-400 uppercase">Agent</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Notes Written</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">KYC Reviewed</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-gray-400 uppercase text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agentStats.slice(0, 10).map(a => (
                      <tr key={a.agentId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                              {a.agentName[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{a.agentName}</p>
                              <p className="text-xs text-gray-400">{a.agentEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-right text-sm text-gray-700">{a.noteCount}</td>
                        <td className="px-5 py-2.5 text-right text-sm text-gray-700">{a.kycCasesReviewed}</td>
                        <td className="px-5 py-2.5 text-right text-sm font-semibold text-gray-900">{a.noteCount + a.kycCasesReviewed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Competitive context strip ─────────────────────────────────────── */}
        <Card className="bg-gradient-to-r from-gray-900 to-gray-800 border-0 text-white">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-white/90 mb-1">WeSupport vs Industry Benchmarks</p>
              <p className="text-xs text-white/50">Based on SaaS support team averages (Zendesk/Gmail/Intercom benchmarks)</p>
            </div>
            <div className="flex gap-6 flex-wrap">
              {[
                { metric: "First Response", yours: data?.responseTimes.intercom ? `${data.responseTimes.intercom}h` : "—", benchmark: "< 2h", ok: (data?.responseTimes.intercom ?? 99) <= 2 },
                { metric: "Email Response", yours: data?.responseTimes.gmail ? `${data.responseTimes.gmail}h` : "—",    benchmark: "< 4h", ok: (data?.responseTimes.gmail ?? 99) <= 4 },
                { metric: "SLA On-Time",    yours: data ? `${data.slaHealth.onTime}%` : "—",  benchmark: "> 90%", ok: (data?.slaHealth.onTime ?? 0) >= 90 },
                { metric: "Weekly Volume",  yours: data ? `${data.summary.newLast7Days}` : "—", benchmark: "—", ok: true },
              ].map(row => (
                <div key={row.metric} className="text-center">
                  <p className="text-xs text-white/50 mb-1">{row.metric}</p>
                  <p className={`text-base font-bold ${row.ok ? "text-green-400" : "text-amber-400"}`}>{row.yours}</p>
                  <p className="text-xs text-white/30">target {row.benchmark}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
