import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// GET /api/csat/surveys — authenticated, paginated
router.get("/surveys", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const [surveys, total] = await Promise.all([
    prisma.csatSurvey.findMany({ orderBy: { sentAt: "desc" }, skip, take: limit }),
    prisma.csatSurvey.count(),
  ]);
  res.json({ surveys, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/csat/analytics — authenticated
router.get("/analytics", async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [total, responded, scoreAgg, distribution] = await Promise.all([
    prisma.csatSurvey.count(),
    prisma.csatSurvey.count({ where: { respondedAt: { not: null } } }),
    prisma.csatSurvey.aggregate({
      where: { score: { not: null } },
      _avg: { score: true },
    }),
    prisma.csatSurvey.groupBy({
      by: ["score"],
      where: { score: { not: null } },
      _count: { id: true },
    }),
  ]);

  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  const avgScore = scoreAgg._avg.score ? Math.round(scoreAgg._avg.score * 10) / 10 : null;

  const scoreDistribution = [1, 2, 3, 4, 5].map((s) => ({
    score: s,
    count: distribution.find((d) => d.score === s)?._count.id ?? 0,
  }));

  // 30-day daily trend
  const recentSurveys = await prisma.csatSurvey.findMany({
    where: { sentAt: { gte: thirtyDaysAgo } },
    select: { sentAt: true, score: true },
  });
  const trendMap = new Map<string, { sent: number; scored: number; total: number }>();
  for (const s of recentSurveys) {
    const day = s.sentAt.toISOString().split("T")[0];
    const entry = trendMap.get(day) ?? { sent: 0, scored: 0, total: 0 };
    entry.sent++;
    if (s.score) { entry.scored++; entry.total += s.score; }
    trendMap.set(day, entry);
  }
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      sent: d.sent,
      avgScore: d.scored > 0 ? Math.round((d.total / d.scored) * 10) / 10 : null,
    }));

  res.json({ total, responded, responseRate, avgScore, scoreDistribution, trend });
});

// GET /api/csat/respond/:token — PUBLIC
router.get("/respond/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const survey = await prisma.csatSurvey.findUnique({ where: { token } });
  if (!survey) { res.status(404).json({ error: "Survey not found" }); return; }
  res.json({
    token,
    channel: survey.channel,
    customerEmail: survey.customerEmail,
    alreadyResponded: !!survey.respondedAt,
    score: survey.score,
  });
});

// POST /api/csat/respond/:token — PUBLIC
router.post("/respond/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const bodySchema = z.object({
    score: z.number().int().min(1).max(5),
    feedback: z.string().max(1000).optional(),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid score (1-5 required)" }); return; }

  const survey = await prisma.csatSurvey.findUnique({ where: { token } });
  if (!survey) { res.status(404).json({ error: "Survey not found" }); return; }
  if (survey.respondedAt) { res.status(409).json({ error: "Already responded" }); return; }

  await prisma.csatSurvey.update({
    where: { token },
    data: { score: parsed.data.score, feedback: parsed.data.feedback, respondedAt: new Date() },
  });
  res.json({ ok: true, message: "Thank you for your feedback!" });
});

export default router;
