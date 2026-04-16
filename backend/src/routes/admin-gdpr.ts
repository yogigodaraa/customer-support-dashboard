import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/gdpr/export/:userId — full data export for a user
router.get("/export/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true, timezone: true, locale: true,
      oooEnabled: true, oooMessage: true, createdAt: true, updatedAt: true,
      notificationPref: true,
      savedSearches: { select: { query: true, name: true, createdAt: true } },
      auditLogs: { select: { action: true, resource: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      teamMemberships: { include: { team: { select: { name: true } } } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const kycCases = await prisma.kycCase.findMany({
    where: { customerEmail: user.email },
    select: { id: true, status: true, riskLevel: true, createdAt: true, updatedAt: true },
  });

  const internalNotes = await prisma.internalNote.findMany({
    where: { authorId: userId },
    select: { body: true, createdAt: true },
  });

  const export_ = { user, kycCases, internalNotes, exportedAt: new Date().toISOString() };

  res.setHeader("Content-Disposition", `attachment; filename="gdpr-export-${userId}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json(export_);
});

// DELETE /api/admin/gdpr/delete/:userId — right to erasure (anonymise)
router.delete("/delete/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  // Anonymise PII but keep audit trail
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@anonymous.invalid`,
      name: "[Deleted]",
      image: null,
      signature: null,
      signatureHtml: null,
      passwordHash: "",
      twoFactorSecret: null,
      oooMessage: null,
    },
  });

  // Delete sessions and notification prefs
  await prisma.userSession.deleteMany({ where: { userId } });
  await prisma.notificationPreference.deleteMany({ where: { userId } });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: "gdpr_delete",
      resource: user.email,
      details: { targetUserId: userId },
    },
  }).catch(() => {});

  res.json({ ok: true, message: "User data anonymised" });
});

export default router;
