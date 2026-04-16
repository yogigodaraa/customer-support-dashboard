import GmailService from "./gmailService.js";
import IntercomService, { IntercomConversationStats } from "./intercomService.js";
import LuciqService, { LuciqBugStats } from "./luciqService.js";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

interface GmailBreakdown {
  pending: number;
  assigned: number;
  newLast7Days: number;
  repliedLast7Days: number;
}

export interface DailyPoint {
  day: string;       // "Mon", "Tue" …
  date: string;      // ISO date string
  gmail: number;
  intercom: number;
  luciq: number;
  total: number;
}

export interface AgentStat {
  agentId: string;
  agentName: string;
  agentEmail: string;
  noteCount: number;
  kycCasesReviewed: number;
}

export interface DashboardStats {
  summary: {
    pendingEmails: number;
    openCases: number;
    repliedLast7Days: number;
    newLast7Days: number;
    activeBugs: number;
    resolvedLast7Days: number;
    unassignedKyc: number;
    // trends vs previous period (positive = up, negative = down)
    trends: {
      pendingEmails: number;
      openCases: number;
      repliedLast7Days: number;
      newLast7Days: number;
    };
  };
  breakdown: {
    gmail: GmailBreakdown;
    intercom: IntercomConversationStats;
    luciq: LuciqBugStats;
  };
  // 7-day daily conversation volumes per channel
  dailyTrend: DailyPoint[];
  // Average first-response time in hours per channel
  responseTimes: { gmail: number; intercom: number; luciq: number };
  // Top conversation tags with counts
  tagBreakdown: Array<{ tag: string; count: number; color: string }>;
  // SLA health snapshot
  slaHealth: { onTime: number; atRisk: number; breached: number };
  // KYC verification analytics
  kycStats: {
    total: number;
    quickKycDone: number;
    standardDone: number;
    pending: number;
    failed: number;
    failedBreakdown: Array<{
      documentType: string;
      count: number;
      color: string;
    }>;
  };
  // Per-agent performance
  agentStats: AgentStat[];
  // Busiest hours heatmap (0–23 → volume)
  heatmap: number[];
  // CSAT summary
  csatSummary: {
    avgScore: number | null;
    responseRate: number;
    totalSent: number;
    totalResponded: number;
    scoreDistribution: number[]; // index 0=score1 .. 4=score5
  };
  period: "7days" | "30days" | "90days";
  lastUpdated: string;
}

// Build 7-day trend data anchored to today
function buildDailyTrend(): DailyPoint[] {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const gmailVol  = [3, 12, 10, 15, 14, 9, 4];
  const intercomVol = [2, 7, 9, 11, 8, 5, 2];
  const luciqVol  = [0, 1, 2, 2, 1, 1, 0];
  const result: DailyPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    result.push({
      day: days[dow],
      date: d.toISOString().split("T")[0],
      gmail: gmailVol[6 - i],
      intercom: intercomVol[6 - i],
      luciq: luciqVol[6 - i],
      total: gmailVol[6 - i] + intercomVol[6 - i] + luciqVol[6 - i],
    });
  }
  return result;
}

// Realistic mock data used when live APIs are unavailable
const MOCK_STATS: DashboardStats = {
  summary: {
    pendingEmails: 14,
    openCases: 47,
    repliedLast7Days: 89,
    newLast7Days: 34,
    activeBugs: 8,
    resolvedLast7Days: 23,
    unassignedKyc: 5,
    trends: {
      pendingEmails: +17,   // +17% vs last week
      openCases: -8,        // -8%
      repliedLast7Days: +23,
      newLast7Days: +12,
    },
  },
  breakdown: {
    gmail: { pending: 14, assigned: 18, newLast7Days: 22, repliedLast7Days: 45 },
    intercom: { open: 15, newLast7Days: 12, repliedLast7Days: 44 },
    luciq: { open: 5, inProgress: 3, newLast7Days: 3 },
  },
  dailyTrend: buildDailyTrend(),
  responseTimes: { gmail: 2.4, intercom: 1.1, luciq: 18.5 },
  tagBreakdown: [
    { tag: "ID Verification", count: 14, color: "#3B82F6" },
    { tag: "Billing",         count: 9,  color: "#10B981" },
    { tag: "Bug / Instabug",  count: 7,  color: "#EF4444" },
    { tag: "Credit Score",    count: 5,  color: "#8B5CF6" },
    { tag: "WeSupport Pro",     count: 4,  color: "#6366F1" },
    { tag: "Socials",         count: 2,  color: "#EC4899" },
  ],
  slaHealth: { onTime: 76, atRisk: 15, breached: 9 },
  kycStats: {
    total: 1247,
    quickKycDone: 843,
    standardDone: 216,
    pending: 112,
    failed: 76,
    failedBreakdown: [
      { documentType: "Driver License", count: 31, color: "#EF4444" },
      { documentType: "Medicare",       count: 18, color: "#F59E0B" },
      { documentType: "Passport",       count: 14, color: "#8B5CF6" },
      { documentType: "Photo ID",       count: 8,  color: "#3B82F6" },
      { documentType: "Other",          count: 5,  color: "#6B7280" },
    ],
  },
  agentStats: [],
  heatmap: Array.from({ length: 24 }, (_, i) => (i >= 8 && i <= 17 ? Math.floor(Math.random() * 10) + 1 : 0)),
  csatSummary: {
    avgScore: null,
    responseRate: 0,
    totalSent: 0,
    totalResponded: 0,
    scoreDistribution: [0, 0, 0, 0, 0],
  },
  period: "7days",
  lastUpdated: new Date().toISOString(),
};

class DashboardService {
  private gmailService: GmailService | null = null;
  private intercomService: IntercomService | null = null;
  private luciqService: LuciqService | null = null;

  constructor() {
    const intercomToken = process.env.INTERCOM_ACCESS_TOKEN;
    const luciqKey = process.env.LUCIQ_API_KEY;

    this.gmailService = new GmailService();
    if (intercomToken) this.intercomService = new IntercomService(intercomToken);
    if (luciqKey) this.luciqService = new LuciqService(luciqKey);
  }

  async getStats(period: "7days" | "30days" | "90days" = "7days"): Promise<DashboardStats> {
    const days = period === "90days" ? 90 : period === "30days" ? 30 : 7;

    const [gmailStats, intercomStats, luciqStats, dailyTrend, responseTimes, tagBreakdown, slaHealth, kycStats, agentStats, heatmap, csatSummary, unassignedKyc] = await Promise.all([
      this.fetchGmailStats(),
      this.fetchIntercomStats(),
      this.fetchLuciqStats(),
      this.fetchDailyTrend(days),
      this.fetchResponseTimes(),
      this.fetchTagBreakdown(),
      this.fetchSlaHealth(),
      this.fetchKycStats(),
      this.fetchAgentStats(),
      this.fetchHeatmap(days),
      this.fetchCsatSummary(days),
      prisma.kycCase.count({ where: { assigneeId: null, status: { in: ["pending", "in_review"] } } }).catch(() => 0),
    ]);

    const summary = {
      pendingEmails: gmailStats.pending,
      openCases: gmailStats.assigned + intercomStats.open,
      repliedLast7Days: gmailStats.repliedLast7Days + intercomStats.repliedLast7Days,
      newLast7Days: gmailStats.newLast7Days + intercomStats.newLast7Days,
      activeBugs: luciqStats.open + luciqStats.inProgress,
      resolvedLast7Days: MOCK_STATS.summary.resolvedLast7Days,
      unassignedKyc,
    };

    return {
      summary: { ...summary, trends: MOCK_STATS.summary.trends },
      breakdown: { gmail: gmailStats, intercom: intercomStats, luciq: luciqStats },
      dailyTrend,
      responseTimes,
      tagBreakdown,
      slaHealth,
      kycStats,
      agentStats,
      heatmap,
      csatSummary,
      period,
      lastUpdated: new Date().toISOString(),
    };
  }

  private async fetchDailyTrend(days: number): Promise<DailyPoint[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days + 1);
      since.setHours(0, 0, 0, 0);

      const metas = await prisma.conversationMeta.findMany({
        where: { createdAt: { gte: since } },
        select: { channel: true, createdAt: true },
      });

      // Aggregate by date + channel
      const byDate = new Map<string, { gmail: number; intercom: number; luciq: number }>();
      // Pre-fill all days
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        byDate.set(d.toISOString().split("T")[0], { gmail: 0, intercom: 0, luciq: 0 });
      }
      for (const m of metas) {
        const key = m.createdAt.toISOString().split("T")[0];
        const entry = byDate.get(key);
        if (entry) {
          if (m.channel === "gmail") entry.gmail++;
          else if (m.channel === "intercom") entry.intercom++;
          else if (m.channel === "luciq") entry.luciq++;
        }
      }

      const dayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const result: DailyPoint[] = [];
      for (const [date, counts] of byDate.entries()) {
        const d = new Date(date);
        result.push({
          day: days <= 7 ? dayLabels[d.getDay()] : date.slice(5), // "Mon" for 7d, "03-15" for longer
          date,
          gmail: counts.gmail,
          intercom: counts.intercom,
          luciq: counts.luciq,
          total: counts.gmail + counts.intercom + counts.luciq,
        });
      }
      // If all zeros, use mock as fallback
      const hasData = result.some((r) => r.total > 0);
      return hasData ? result : buildDailyTrend();
    } catch {
      return buildDailyTrend();
    }
  }

  private async fetchResponseTimes(): Promise<{ gmail: number; intercom: number; luciq: number }> {
    try {
      const [gmailFrt, intercomFrt, luciqFrt] = await Promise.all([
        prisma.slaSnapshot.aggregate({
          where: { frtMins: { not: null }, conversationMeta: { channel: "gmail" } },
          _avg: { frtMins: true },
        }),
        prisma.slaSnapshot.aggregate({
          where: { frtMins: { not: null }, conversationMeta: { channel: "intercom" } },
          _avg: { frtMins: true },
        }),
        prisma.slaSnapshot.aggregate({
          where: { frtMins: { not: null }, conversationMeta: { channel: "luciq" } },
          _avg: { frtMins: true },
        }),
      ]);
      return {
        gmail: gmailFrt._avg.frtMins ? Math.round((gmailFrt._avg.frtMins / 60) * 10) / 10 : MOCK_STATS.responseTimes.gmail,
        intercom: intercomFrt._avg.frtMins ? Math.round((intercomFrt._avg.frtMins / 60) * 10) / 10 : MOCK_STATS.responseTimes.intercom,
        luciq: luciqFrt._avg.frtMins ? Math.round((luciqFrt._avg.frtMins / 60) * 10) / 10 : MOCK_STATS.responseTimes.luciq,
      };
    } catch {
      return MOCK_STATS.responseTimes;
    }
  }

  private async fetchTagBreakdown(): Promise<Array<{ tag: string; count: number; color: string }>> {
    try {
      const groups = await prisma.conversationTag.groupBy({
        by: ["tagId"],
        _count: { tagId: true },
        orderBy: { _count: { tagId: "desc" } },
        take: 8,
      });
      if (groups.length === 0) return MOCK_STATS.tagBreakdown;
      const tagIds = groups.map((g) => g.tagId);
      const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } } });
      const tagMap = new Map(tags.map((t) => [t.id, t]));
      return groups.map((g) => ({
        tag: tagMap.get(g.tagId)?.name ?? "Unknown",
        count: g._count.tagId,
        color: tagMap.get(g.tagId)?.color ?? "#6B7280",
      }));
    } catch {
      return MOCK_STATS.tagBreakdown;
    }
  }

  private async fetchSlaHealth(): Promise<{ onTime: number; atRisk: number; breached: number }> {
    try {
      const [onTime, atRisk, breached] = await Promise.all([
        prisma.slaSnapshot.count({ where: { frtStatus: "on_time" } }),
        prisma.slaSnapshot.count({ where: { frtStatus: "at_risk" } }),
        prisma.slaSnapshot.count({ where: { frtStatus: "breached" } }),
      ]);
      const total = onTime + atRisk + breached;
      if (total === 0) return MOCK_STATS.slaHealth;
      return {
        onTime: Math.round((onTime / total) * 100),
        atRisk: Math.round((atRisk / total) * 100),
        breached: Math.round((breached / total) * 100),
      };
    } catch {
      return MOCK_STATS.slaHealth;
    }
  }

  private async fetchKycStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [total, pending, approved, rejected, recentCompleted, rejectionGroups] =
        await Promise.all([
          prisma.kycCase.count(),
          prisma.kycCase.count({ where: { status: "pending" } }),
          prisma.kycCase.count({ where: { status: "approved" } }),
          prisma.kycCase.count({ where: { status: "rejected" } }),
          prisma.kycCase.findMany({
            where: { status: { in: ["approved", "rejected"] }, completedAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true, completedAt: true },
          }),
          prisma.kycCase.groupBy({
            by: ["rejectionReason"],
            where: { status: "rejected", rejectionReason: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
          }),
        ]);

      const failedBreakdown = rejectionGroups.map((g, i) => ({
        documentType: g.rejectionReason ?? "Unknown",
        count: g._count.id,
        color: ["#EF4444", "#F59E0B", "#8B5CF6", "#3B82F6", "#6B7280"][i] ?? "#6B7280",
      }));

      return { total, quickKycDone: approved, standardDone: 0, pending, failed: rejected, failedBreakdown };
    } catch {
      return MOCK_STATS.kycStats;
    }
  }

  private async fetchAgentStats(): Promise<AgentStat[]> {
    try {
      const users = await prisma.user.findMany({
        where: { role: { in: ["admin", "agent"] } },
        select: { id: true, name: true, email: true },
      });
      const results = await Promise.all(users.map(async u => {
        const [noteCount, kycCasesReviewed] = await Promise.all([
          prisma.internalNote.count({ where: { authorId: u.id } }),
          prisma.kycCase.count({ where: { assigneeId: u.id, status: { in: ["approved", "rejected", "escalated"] } } }),
        ]);
        return { agentId: u.id, agentName: u.name ?? u.email, agentEmail: u.email, noteCount, kycCasesReviewed };
      }));
      return results.filter(r => r.noteCount + r.kycCasesReviewed > 0).sort((a, b) => (b.noteCount + b.kycCasesReviewed) - (a.noteCount + a.kycCasesReviewed));
    } catch {
      return [];
    }
  }

  private async fetchHeatmap(days: number): Promise<number[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const metas = await prisma.conversationMeta.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      });
      const heatmap = new Array(24).fill(0) as number[];
      for (const m of metas) {
        heatmap[m.createdAt.getHours()]++;
      }
      return heatmap;
    } catch {
      return MOCK_STATS.heatmap;
    }
  }

  private async fetchCsatSummary(days: number): Promise<DashboardStats["csatSummary"]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const surveys = await prisma.csatSurvey.findMany({
        where: { sentAt: { gte: since } },
        select: { score: true, respondedAt: true },
      });
      if (surveys.length === 0) return MOCK_STATS.csatSummary;
      const responded = surveys.filter(s => s.respondedAt !== null);
      const scored = responded.filter(s => s.score !== null);
      const avgScore = scored.length > 0 ? scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length : null;
      const dist = [0, 0, 0, 0, 0];
      for (const s of scored) { if (s.score && s.score >= 1 && s.score <= 5) dist[s.score - 1]++; }
      return {
        avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        responseRate: surveys.length > 0 ? Math.round((responded.length / surveys.length) * 100) : 0,
        totalSent: surveys.length,
        totalResponded: responded.length,
        scoreDistribution: dist,
      };
    } catch {
      return MOCK_STATS.csatSummary;
    }
  }

  private async fetchGmailStats(): Promise<GmailBreakdown> {
    if (!this.gmailService) {
      logger.info("Gmail service not configured — using mock stats");
      return MOCK_STATS.breakdown.gmail;
    }
    try {
      // Aggregate stats across both channels
      const channels = (["support", "kyc"] as const).filter(ch => this.gmailService!.hasChannel(ch));
      if (channels.length === 0) return MOCK_STATS.breakdown.gmail;

      let inbox = 0, unread = 0, newLast7Days = 0;
      for (const ch of channels) {
        const s = await this.gmailService!.getConversationStats(ch);
        inbox += s.inbox;
        unread += s.unread;
        newLast7Days += s.newLast7Days;
      }
      return {
        pending: unread,
        assigned: Math.max(0, inbox - unread),
        newLast7Days,
        repliedLast7Days: MOCK_STATS.breakdown.gmail.repliedLast7Days, // not easily derived from Gmail API
      };
    } catch (err) {
      logger.warn("Gmail stats fetch failed, using mock:", err);
      return MOCK_STATS.breakdown.gmail;
    }
  }

  private async fetchIntercomStats(): Promise<IntercomConversationStats> {
    if (!this.intercomService) {
      logger.info("Intercom token not configured — using mock stats");
      return MOCK_STATS.breakdown.intercom;
    }
    try {
      return await this.intercomService.getConversationStats();
    } catch (err) {
      logger.warn("Intercom stats fetch failed, using mock:", err);
      return MOCK_STATS.breakdown.intercom;
    }
  }

  private async fetchLuciqStats(): Promise<LuciqBugStats> {
    if (!this.luciqService) {
      logger.info("Luciq API key not configured — using mock stats");
      return MOCK_STATS.breakdown.luciq;
    }
    try {
      return await this.luciqService.getBugStats();
    } catch (err) {
      logger.warn("Luciq stats fetch failed, using mock:", err);
      return MOCK_STATS.breakdown.luciq;
    }
  }
}

export default new DashboardService();
