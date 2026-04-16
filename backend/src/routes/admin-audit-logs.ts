import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { auditLogQuerySchema } from "../schemas/admin.js";

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/audit-logs?page=1&limit=50&action=login&userId=...
router.get("/", validate({ query: auditLogQuerySchema }), async (req: Request, res: Response) => {
  const { page, limit, action, userId } = req.query as unknown as { page: number; limit: number; action?: string; userId?: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export default router;
