import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))];
  return lines.join("\n");
}

// GET /api/export/conversations
router.get("/conversations", async (_req: Request, res: Response) => {
  const metas = await prisma.conversationMeta.findMany({
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const headers = ["channel", "externalId", "createdAt", "resolvedAt", "firstResponseAt", "snoozedUntil", "tags"];
  const rows = metas.map((m) => [
    m.channel,
    m.externalId,
    m.createdAt.toISOString(),
    m.resolvedAt?.toISOString() ?? "",
    m.firstResponseAt?.toISOString() ?? "",
    m.snoozedUntil?.toISOString() ?? "",
    m.tags.map((t) => t.tag.name).join(";"),
  ]);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="conversations.csv"');
  res.send(toCSV(headers, rows));
});

// GET /api/export/sla-report
router.get("/sla-report", async (_req: Request, res: Response) => {
  const snaps = await prisma.slaSnapshot.findMany({
    include: { conversationMeta: { select: { channel: true, externalId: true } } },
    orderBy: { recordedAt: "desc" },
    take: 10000,
  });

  const headers = ["channel", "externalId", "frtMins", "frtStatus", "resMins", "resStatus", "recordedAt"];
  const rows = snaps.map((s) => [
    s.conversationMeta.channel,
    s.conversationMeta.externalId,
    s.frtMins ?? "",
    s.frtStatus ?? "",
    s.resMins ?? "",
    s.resStatus ?? "",
    s.recordedAt.toISOString(),
  ]);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="sla-report.csv"');
  res.send(toCSV(headers, rows));
});

// GET /api/export/kyc-cases
router.get("/kyc-cases", async (_req: Request, res: Response) => {
  const cases = await prisma.kycCase.findMany({
    include: { assignee: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const headers = ["id", "customerName", "customerEmail", "status", "riskLevel", "isPriority", "assignee", "rejectionReason", "createdAt", "completedAt"];
  const rows = cases.map((c) => [
    c.id,
    c.customerName,
    c.customerEmail,
    c.status,
    c.riskLevel,
    c.isPriority ? "yes" : "no",
    c.assignee?.name ?? c.assignee?.email ?? "",
    c.rejectionReason ?? "",
    c.createdAt.toISOString(),
    c.completedAt?.toISOString() ?? "",
  ]);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="kyc-cases.csv"');
  res.send(toCSV(headers, rows));
});

export default router;
