import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { validate } from "../middleware/validate.js";
import { updateSettingsSchema, changePasswordSchema } from "../schemas/settings.js";
import { notificationPrefSchema } from "../schemas/workspace.js";
import logger from "../utils/logger.js";

const router = Router();
const prisma = new PrismaClient();

const USER_SELECT = {
  name: true, email: true, signature: true, signatureHtml: true, theme: true,
  image: true, timezone: true, locale: true,
  oooEnabled: true, oooMessage: true, oooUntil: true,
  soundNotifications: true, desktopNotifications: true,
} as const;

// GET /api/settings
router.get("/", async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: USER_SELECT,
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// PATCH /api/settings
router.patch("/", validate({ body: updateSettingsSchema }), async (req: Request, res: Response) => {
  const allowed = [
    "name","signature","signatureHtml","theme","image","timezone","locale",
    "oooEnabled","oooMessage","oooUntil","soundNotifications","desktopNotifications",
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  // Convert oooUntil string to Date or null
  if (data.oooUntil === null || data.oooUntil === "") data.oooUntil = null;
  else if (typeof data.oooUntil === "string") data.oooUntil = new Date(data.oooUntil);

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data,
    select: USER_SELECT,
  });

  await prisma.auditLog.create({
    data: { userId: req.user!.userId, action: "update_settings", resource: req.user!.email, details: { fields: Object.keys(data) } },
  }).catch(() => {});

  res.json(user);
});

// PATCH /api/settings/password
router.patch("/password", validate({ body: changePasswordSchema }), async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user!.userId }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: { userId: req.user!.userId, action: "change_password", resource: req.user!.email },
  }).catch(() => {});

  res.json({ ok: true });
});

// GET /api/settings/notifications
router.get("/notifications", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const pref = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  res.json(pref);
});

// PATCH /api/settings/notifications
router.patch("/notifications", validate({ body: notificationPrefSchema }), async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const pref = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...req.body },
    update: req.body,
  });
  res.json(pref);
});

// GET /api/settings/sessions — list current user's active sessions
router.get("/sessions", async (req: Request, res: Response) => {
  const sessions = await prisma.userSession.findMany({
    where: { userId: req.user!.userId },
    orderBy: { lastActiveAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastActiveAt: true },
  });
  res.json({ sessions });
});

// DELETE /api/settings/sessions/:id — revoke a session
router.delete("/sessions/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = await prisma.userSession.findUnique({ where: { id } });
  if (!session || session.userId !== req.user!.userId) {
    return res.status(404).json({ error: "Session not found" });
  }
  await prisma.userSession.delete({ where: { id } });
  res.json({ ok: true });
});

// DELETE /api/settings/sessions — revoke ALL other sessions
router.delete("/sessions", async (req: Request, res: Response) => {
  await prisma.userSession.deleteMany({
    where: { userId: req.user!.userId },
  });
  res.json({ ok: true });
});

export default router;
