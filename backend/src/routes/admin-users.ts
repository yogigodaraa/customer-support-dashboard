import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { changeRoleSchema, userParamsSchema } from "../schemas/admin.js";
import logger from "../utils/logger.js";

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/users
router.get("/", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ users });
});

// PATCH /api/admin/users/:id/role
router.patch("/:id/role", validate({ params: userParamsSchema, body: changeRoleSchema }), async (req: Request, res: Response) => {
  const { role } = req.body;

  // Prevent self-demotion
  if (req.params.id === req.user!.userId && role !== "admin") {
    return res.status(400).json({ error: "Cannot change your own role" });
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: "change_role",
      resource: target.email,
      details: { from: target.role, to: role },
    },
  }).catch(() => {});

  res.json(updated);
});

// DELETE /api/admin/users/:id
router.delete("/:id", validate({ params: userParamsSchema }), async (req: Request, res: Response) => {
  if (req.params.id === req.user!.userId) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  await prisma.user.delete({ where: { id: req.params.id } });

  await prisma.auditLog.create({
    data: { userId: req.user!.userId, action: "delete_user", resource: target.email },
  }).catch(() => {});

  res.json({ ok: true });
});

export default router;
