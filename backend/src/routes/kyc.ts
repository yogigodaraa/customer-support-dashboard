import { Router, Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import path from "path";
import fs from "fs";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";
import { kycUpload } from "../middleware/upload.js";
import { emitToChannel } from "../websocket.js";
import logger from "../utils/logger.js";
import {
  createCaseSchema,
  listCasesSchema,
  updateStatusSchema,
  assignSchema,
  checklistSchema,
  docTypeSchema,
  docReviewSchema,
  bulkStatusSchema,
  caseParamsSchema,
  docParamsSchema,
  REJECTION_REASONS,
} from "../schemas/kyc.js";

const router = Router();
const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function autoAssign(): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: { role: { in: ["admin", "agent"] } },
    select: { id: true },
  });
  if (agents.length === 0) return null;

  const counts = await Promise.all(
    agents.map((a) =>
      prisma.kycCase.count({
        where: { assigneeId: a.id, status: { in: ["pending", "in_review"] } },
      })
    )
  );
  const minCount = Math.min(...counts);
  return agents[counts.indexOf(minCount)].id;
}

async function logAudit(
  caseId: string,
  agentId: string,
  action: string,
  extras: Partial<{
    fromStatus: string;
    toStatus: string;
    details: Record<string, unknown>;
    ipAddress: string;
  }> = {}
): Promise<void> {
  await prisma.kycAuditLog.create({
    data: {
      caseId,
      agentId,
      action,
      fromStatus: extras.fromStatus,
      toStatus: extras.toStatus,
      details: extras.details as Prisma.InputJsonValue,
      ipAddress: extras.ipAddress,
    },
  });
}

// ─── GET /api/kyc/stats ───────────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingCount,
    inReviewCount,
    approvedToday,
    rejectedToday,
    recentCompleted,
    rejectionGroups,
  ] = await Promise.all([
    prisma.kycCase.count({ where: { status: "pending" } }),
    prisma.kycCase.count({ where: { status: "in_review" } }),
    prisma.kycCase.count({ where: { status: "approved", completedAt: { gte: today } } }),
    prisma.kycCase.count({ where: { status: "rejected", completedAt: { gte: today } } }),
    prisma.kycCase.findMany({
      where: { status: { in: ["approved", "rejected"] }, completedAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.kycCase.groupBy({
      by: ["rejectionReason"],
      where: { status: "rejected", rejectionReason: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  // Average verification time
  const avgVerificationHours =
    recentCompleted.length > 0
      ? recentCompleted.reduce((sum, c) => {
          const ms = (c.completedAt?.getTime() ?? 0) - c.createdAt.getTime();
          return sum + ms / 3600000;
        }, 0) / recentCompleted.length
      : 0;

  // Volume trend: last 7 days
  const volumeTrend: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(Date.now() - i * 86400000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const count = await prisma.kycCase.count({
      where: { createdAt: { gte: dayStart, lt: dayEnd } },
    });
    volumeTrend.push({ date: dayStart.toISOString().slice(0, 10), count });
  }

  // Approval rate (last 30 days)
  const totalResolved = recentCompleted.length;
  const approvedResolved = await prisma.kycCase.count({
    where: { status: "approved", completedAt: { gte: thirtyDaysAgo } },
  });
  const approvalRate =
    totalResolved > 0 ? Math.round((approvedResolved / totalResolved) * 100) : 0;

  res.json({
    pendingCount,
    inReviewCount,
    approvedToday,
    rejectedToday,
    avgVerificationHours: Math.round(avgVerificationHours * 10) / 10,
    rejectionReasons: rejectionGroups.map((g) => ({
      reason: g.rejectionReason ?? "Unknown",
      count: g._count.id,
    })),
    volumeTrend,
    approvalRate,
  });
});

// ─── GET /api/kyc/rejection-reasons ──────────────────────────────────────────

router.get("/rejection-reasons", (_req: Request, res: Response) => {
  res.json(REJECTION_REASONS);
});

// ─── GET /api/kyc/cases ───────────────────────────────────────────────────────

router.get(
  "/cases",
  validate({ query: listCasesSchema }),
  async (req: Request, res: Response) => {
    const { status, riskLevel, assigneeId, search, page, limit } = req.query as {
      status: string;
      riskLevel: string;
      assigneeId?: string;
      search?: string;
      page: string;
      limit: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const where: Prisma.KycCaseWhereInput = {};
    if (status !== "all") where.status = status;
    if (riskLevel !== "all") where.riskLevel = riskLevel;
    if (assigneeId) where.assigneeId = assigneeId;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, cases] = await Promise.all([
      prisma.kycCase.count({ where }),
      prisma.kycCase.findMany({
        where,
        orderBy: [{ isPriority: "desc" }, { createdAt: "desc" }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { documents: true } },
        },
      }),
    ]);

    // Status counts for tabs
    const counts = await prisma.kycCase.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const statusCounts = Object.fromEntries(counts.map((c) => [c.status, c._count.id]));

    res.json({ cases, total, page: pageNum, limit: limitNum, statusCounts });
  }
);

// ─── POST /api/kyc/cases ──────────────────────────────────────────────────────

router.post(
  "/cases",
  validate({ body: createCaseSchema }),
  async (req: Request, res: Response) => {
    const agentId = (req as any).user?.userId as string;
    const data = req.body as {
      customerName: string;
      customerEmail: string;
      customerId?: string;
      riskLevel: string;
      isPriority: boolean;
      gmailThreadId?: string;
    };

    const assigneeId = await autoAssign();

    const kycCase = await prisma.kycCase.create({
      data: {
        ...data,
        assigneeId,
        checklist: { id_verified: null, address_verified: null, face_match: null },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit(kycCase.id, agentId, "created", {
      toStatus: "pending",
      details: { assigneeId },
    });

    emitToChannel("kyc", "kyc:case_created", {
      caseId: kycCase.id,
      customerName: kycCase.customerName,
    });

    res.status(201).json(kycCase);
  }
);

// ─── GET /api/kyc/cases/:id ───────────────────────────────────────────────────

router.get(
  "/cases/:id",
  validate({ params: caseParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const kycCase = await prisma.kycCase.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!kycCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    res.json(kycCase);
  }
);

// ─── PATCH /api/kyc/cases/:id/status ─────────────────────────────────────────

router.patch(
  "/cases/:id/status",
  validate({ params: caseParamsSchema, body: updateStatusSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body as {
      status: string;
      rejectionReason?: string;
    };
    const agentId = (req as any).user?.userId as string;

    const existing = await prisma.kycCase.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const isTerminal = status === "approved" || status === "rejected";
    const updated = await prisma.kycCase.update({
      where: { id },
      data: {
        status,
        rejectionReason: rejectionReason ?? null,
        reviewedAt: status === "in_review" ? new Date() : existing.reviewedAt,
        completedAt: isTerminal ? new Date() : existing.completedAt,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
      },
    });

    await logAudit(id, agentId, "status_changed", {
      fromStatus: existing.status,
      toStatus: status,
      details: rejectionReason ? { rejectionReason } : undefined,
      ipAddress: req.ip,
    });

    emitToChannel("kyc", "kyc:status_changed", {
      caseId: id,
      fromStatus: existing.status,
      toStatus: status,
    });

    res.json(updated);
  }
);

// ─── PATCH /api/kyc/cases/:id/assign ─────────────────────────────────────────

router.patch(
  "/cases/:id/assign",
  validate({ params: caseParamsSchema, body: assignSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assigneeId } = req.body as { assigneeId: string | null };
    const agentId = (req as any).user?.userId as string;

    const updated = await prisma.kycCase.update({
      where: { id },
      data: { assigneeId },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    await logAudit(id, agentId, "assigned", {
      details: { assigneeId },
    });

    emitToChannel("kyc", "kyc:assigned", { caseId: id, assigneeId });
    res.json(updated);
  }
);

// ─── PATCH /api/kyc/cases/:id/checklist ──────────────────────────────────────

router.patch(
  "/cases/:id/checklist",
  validate({ params: caseParamsSchema, body: checklistSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const agentId = (req as any).user?.userId as string;

    const existing = await prisma.kycCase.findUnique({
      where: { id },
      select: { checklist: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const merged = {
      ...(existing.checklist as Record<string, unknown> ?? {}),
      ...req.body,
    };

    const updated = await prisma.kycCase.update({
      where: { id },
      data: { checklist: merged },
    });

    await logAudit(id, agentId, "checklist_updated", {
      details: { checklist: merged },
    });

    res.json(updated);
  }
);

// ─── PATCH /api/kyc/cases/:id/priority ───────────────────────────────────────

router.patch(
  "/cases/:id/priority",
  validate({ params: caseParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = await prisma.kycCase.findUnique({
      where: { id },
      select: { isPriority: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const updated = await prisma.kycCase.update({
      where: { id },
      data: { isPriority: !existing.isPriority },
    });

    res.json(updated);
  }
);

// ─── POST /api/kyc/cases/:id/documents ───────────────────────────────────────

router.post(
  "/cases/:id/documents",
  validate({ params: caseParamsSchema }),
  kycUpload.single("file"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const agentId = (req as any).user?.userId as string;

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Validate document type from body (after multer parses multipart)
    const typeResult = docTypeSchema.safeParse(req.body);
    if (!typeResult.success) {
      // Delete uploaded file
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: "Validation failed", details: typeResult.error.issues });
      return;
    }

    const kycCase = await prisma.kycCase.findUnique({ where: { id } });
    if (!kycCase) {
      fs.unlink(req.file.path, () => {});
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const storagePath = path.relative(
      path.join(process.cwd(), "uploads", "kyc"),
      req.file.path
    );

    const doc = await prisma.kycDocument.create({
      data: {
        caseId: id,
        type: typeResult.data.type,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath,
      },
    });

    await logAudit(id, agentId, "document_uploaded", {
      details: { docId: doc.id, type: doc.type, fileName: doc.fileName },
    });

    emitToChannel("kyc", "kyc:document_uploaded", {
      caseId: id,
      docId: doc.id,
      type: doc.type,
    });

    res.status(201).json(doc);
  }
);

// ─── PATCH /api/kyc/cases/:id/documents/:docId ───────────────────────────────

router.patch(
  "/cases/:id/documents/:docId",
  validate({ params: docParamsSchema, body: docReviewSchema }),
  async (req: Request, res: Response) => {
    const { id, docId } = req.params;
    const { status, reviewNote } = req.body as {
      status: "accepted" | "rejected";
      reviewNote?: string;
    };
    const agentId = (req as any).user?.userId as string;

    const doc = await prisma.kycDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.caseId !== id) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const updated = await prisma.kycDocument.update({
      where: { id: docId },
      data: { status, reviewNote: reviewNote ?? null, reviewedAt: new Date() },
    });

    await logAudit(id, agentId, "document_reviewed", {
      details: { docId, status, reviewNote },
    });

    emitToChannel("kyc", "kyc:document_reviewed", { caseId: id, docId, status });
    res.json(updated);
  }
);

// ─── DELETE /api/kyc/cases/:id/documents/:docId ───────────────────────────────

router.delete(
  "/cases/:id/documents/:docId",
  validate({ params: docParamsSchema }),
  async (req: Request, res: Response) => {
    const { id, docId } = req.params;
    const agentId = (req as any).user?.userId as string;

    const doc = await prisma.kycDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.caseId !== id) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Delete physical file
    const filePath = path.join(process.cwd(), "uploads", "kyc", doc.storagePath);
    fs.unlink(filePath, (err) => {
      if (err) logger.warn(`Could not delete file ${filePath}: ${err.message}`);
    });

    await prisma.kycDocument.delete({ where: { id: docId } });
    await logAudit(id, agentId, "document_deleted", {
      details: { docId, fileName: doc.fileName },
    });

    res.status(204).end();
  }
);

// ─── GET /api/kyc/cases/:id/audit ────────────────────────────────────────────

router.get(
  "/cases/:id/audit",
  validate({ params: caseParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const page = parseInt((req.query.page as string) ?? "1", 10);
    const limit = parseInt((req.query.limit as string) ?? "50", 10);

    const [total, entries] = await Promise.all([
      prisma.kycAuditLog.count({ where: { caseId: id } }),
      prisma.kycAuditLog.findMany({
        where: { caseId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Enrich with agent names
    const agentIds = [...new Set(entries.map((e) => e.agentId))];
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, email: true },
    });
    const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

    res.json({
      entries: entries.map((e) => ({ ...e, agent: agentMap[e.agentId] ?? null })),
      total,
      page,
      limit,
    });
  }
);

// ─── POST /api/kyc/bulk/status ────────────────────────────────────────────────

router.post(
  "/bulk/status",
  validate({ body: bulkStatusSchema }),
  async (req: Request, res: Response) => {
    const { ids, status, rejectionReason } = req.body as {
      ids: string[];
      status: "approved" | "rejected";
      rejectionReason?: string;
    };
    const agentId = (req as any).user?.userId as string;

    const existing = await prisma.kycCase.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });

    await prisma.kycCase.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        rejectionReason: rejectionReason ?? null,
        completedAt: new Date(),
      },
    });

    // Log audit for each
    await Promise.all(
      existing.map((c) =>
        logAudit(c.id, agentId, "status_changed", {
          fromStatus: c.status,
          toStatus: status,
          details: rejectionReason ? { rejectionReason } : undefined,
        })
      )
    );

    emitToChannel("kyc", "kyc:bulk_status_changed", {
      ids,
      status,
    });

    res.json({ ok: true, count: existing.length });
  }
);

export default router;
