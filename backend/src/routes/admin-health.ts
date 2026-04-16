import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import os from "os";

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/health
router.get("/", async (_req: Request, res: Response) => {
  const start = Date.now();

  // DB latency
  let dbLatencyMs = -1;
  let dbOk = false;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch { /* noop */ }

  // Queue depth: count snoozed conversations awaiting un-snooze
  const snoozedCount = await prisma.conversationMeta.count({
    where: { snoozedUntil: { gt: new Date() } },
  }).catch(() => 0);

  // Pending KYC cases
  const kycPending = await prisma.kycCase.count({ where: { status: "pending" } }).catch(() => 0);

  // Session count
  const activeSessions = await prisma.userSession.count().catch(() => 0);

  // Uptime / memory
  const uptimeSecs = Math.floor(process.uptime());
  const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const loadAvg = os.loadavg()[0].toFixed(2);

  res.json({
    status: dbOk ? "ok" : "degraded",
    latencyMs: Date.now() - start,
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    queues: { snoozed: snoozedCount, kycPending },
    sessions: { active: activeSessions },
    system: { uptimeSecs, memMb, loadAvg },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/admin/health/sessions — all active sessions (admin view)
router.get("/sessions", async (_req: Request, res: Response) => {
  const sessions = await prisma.userSession.findMany({
    orderBy: { lastActiveAt: "desc" },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  res.json({ sessions });
});

// DELETE /api/admin/health/sessions/:id — force-revoke any session
router.delete("/sessions/:id", async (req: Request, res: Response) => {
  await prisma.userSession.delete({ where: { id: req.params.id } }).catch(() => {});
  res.json({ ok: true });
});

export default router;
