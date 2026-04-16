import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import authService from "../services/authService.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../schemas/auth.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimiter.js";
import logger from "../utils/logger.js";

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/login — public
router.post("/login", loginLimiter, validate({ body: loginSchema }), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || undefined;
    const userAgent = req.headers["user-agent"] || undefined;
    const result = await authService.login(email, password, ip, userAgent);

    // Audit log
    await prisma.auditLog.create({
      data: { userId: result.user.id, action: "login", resource: email },
    }).catch(() => {});

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Login failed";
    res.status(401).json({ error: "Unauthorized", message: msg });
  }
});

// POST /api/auth/2fa/verify-login — complete login when 2FA is required (public)
router.post("/2fa/verify-login", async (req: Request, res: Response) => {
  const { pendingToken, code } = req.body as { pendingToken?: string; code?: string };
  if (!pendingToken || !code) {
    res.status(400).json({ error: "pendingToken and code are required" });
    return;
  }
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || undefined;
    const userAgent = req.headers["user-agent"] || undefined;
    const result = await authService.completeTwoFactor(pendingToken, code, ip, userAgent);

    await prisma.auditLog.create({
      data: { userId: result.user.id, action: "login_2fa", resource: result.user.email },
    }).catch(() => {});

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(401).json({ error: "Unauthorized", message: msg });
  }
});

// POST /api/auth/register — admin-only (invite flow)
router.post("/register", registerLimiter, requireAuth, requireRole("admin"), validate({ body: registerSchema }), async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;
  try {
    const result = await authService.register(email, password, name, role);

    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: "invite_user", resource: email, details: { role: role || "agent" } },
    }).catch(() => {});

    res.status(201).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    res.status(400).json({ error: msg });
  }
});

// GET /api/auth/me — authenticated user info
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await authService.getUserById(req.user!.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

export default router;
