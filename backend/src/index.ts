import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import "express-async-errors";
import { PrismaClient } from "@prisma/client";
import searchRoutes from "./routes/search.js";
import integrationRoutes from "./routes/integrations.js";
import dashboardRoutes from "./routes/dashboard.js";
import templateRoutes from "./routes/templates.js";
import gmailRoutes from "./routes/gmail.js";
import luciqBugRoutes from "./routes/luciq-bugs.js";
import intercomRoutes from "./routes/intercom-conversations.js";
import webhookRoutes from "./routes/webhooks.js";
import aiRoutes from "./routes/ai.js";
import authRoutes from "./routes/auth.js";
import settingsRoutes from "./routes/settings.js";
import adminUserRoutes from "./routes/admin-users.js";
import adminIntegrationRoutes from "./routes/admin-integrations.js";
import adminAuditLogRoutes from "./routes/admin-audit-logs.js";
import syncService from "./services/syncService.js";
import tagRoutes from "./routes/tags.js";
import metaRoutes from "./routes/conversation-meta.js";
import bulkRoutes from "./routes/bulk.js";
import savedSearchRoutes from "./routes/saved-searches.js";
import slaRoutes from "./routes/sla.js";
import { startSnoozeService, stopSnoozeService } from "./services/snoozeService.js";
import { startSlaService, stopSlaService } from "./services/slaService.js";
import kycRoutes from "./routes/kyc.js";
// Phase 4/5 routes
import workspaceRoutes from "./routes/admin-workspace.js";
import teamsRoutes from "./routes/admin-teams.js";
import twoFaRoutes from "./routes/admin-2fa.js";
import automationRoutes from "./routes/admin-automations.js";
import reportsRoutes from "./routes/admin-reports.js";
import csatRoutes from "./routes/csat.js";
import exportRoutes from "./routes/export.js";
import { startReportScheduler, stopReportScheduler } from "./services/reportService.js";
// Phase 6 routes
import webhookAdminRoutes from "./routes/admin-webhooks.js";
import blockedRoutes from "./routes/admin-blocked.js";
import healthRoutes from "./routes/admin-health.js";
import gdprRoutes from "./routes/admin-gdpr.js";
import { requireAuth, requireRole, requireWriteAccess } from "./middleware/auth.js";
import { globalLimiter, loginLimiter, registerLimiter, searchAiLimiter } from "./middleware/rateLimiter.js";
import { ZodError } from "zod";
import { createServer } from "http";
import { initWebSocket } from "./websocket.js";
import logger from "./utils/logger.js";
import path from "path";

const app: Express = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// ─── Raw body capture (needed for webhook signature verification) ─────────────
// Must be registered BEFORE express.json() so the raw buffer is accessible.
app.use(
  (req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      req.rawBody = Buffer.concat(chunks);
    });
    next();
  }
);

// ─── Standard middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// ─── Request logging ──────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ─── Webhook routes (no auth — Intercom signs its own payloads) ───────────────
app.use("/api/webhooks", webhookRoutes);

// ─── Rate limiting (applied after webhooks so webhooks are exempt) ────────────
app.use(globalLimiter);

// ─── Auth routes (public — login doesn't need a token) ───────────────────────
app.use("/api/auth", authRoutes);

// ─── JWT guard on all other /api/* routes ─────────────────────────────────────
app.use("/api", requireAuth);

// ─── Settings (any authenticated user) ────────────────────────────────────────
app.use("/api/settings", settingsRoutes);

// ─── Admin-only routes ────────────────────────────────────────────────────────
app.use("/api/admin/users", requireRole("admin"), adminUserRoutes);
app.use("/api/admin/integrations", requireRole("admin"), adminIntegrationRoutes);
app.use("/api/admin/audit-logs", requireRole("admin"), adminAuditLogRoutes);

// ─── Read-only API routes (all authenticated roles) ──────────────────────────
app.use("/api/search", searchAiLimiter, searchRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", searchAiLimiter, aiRoutes);

// ─── Write-guarded routes (viewers can read, agents+admins can write) ────────
app.use("/api/templates", requireWriteAccess, templateRoutes);
app.use("/api/gmail", requireWriteAccess, gmailRoutes);
app.use("/api/luciq", requireWriteAccess, luciqBugRoutes);
app.use("/api/intercom", requireWriteAccess, intercomRoutes);

// ─── Phase 2 routes ───────────────────────────────────────────────────────────
app.use("/api/tags", requireWriteAccess, tagRoutes);
app.use("/api/meta/:channel/:externalId", requireWriteAccess, metaRoutes);
app.use("/api/bulk", requireWriteAccess, bulkRoutes);
app.use("/api/saved-searches", savedSearchRoutes);
app.use("/api/sla", slaRoutes);

// ─── Phase 3: KYC routes + document file serving ─────────────────────────────
app.use("/api/kyc", requireWriteAccess, kycRoutes);
app.use(
  "/uploads/kyc",
  requireAuth,
  express.static(path.join(process.cwd(), "uploads", "kyc"))
);

// ─── Phase 4: Workspace, Teams, 2FA ──────────────────────────────────────────
app.use("/api/admin/workspace", requireRole("admin"), workspaceRoutes);
app.use("/api/admin/teams", requireRole("admin"), teamsRoutes);
app.use("/api/auth/2fa", requireAuth, twoFaRoutes);

// ─── Phase 5: Automations, Reports, CSAT (public respond), Export ────────────
// CSAT respond routes are public — must be mounted BEFORE requireAuth
app.use("/api/csat/respond", csatRoutes);
app.use("/api/admin/automations", requireRole("admin"), automationRoutes);
app.use("/api/admin/reports", requireRole("admin"), reportsRoutes);
app.use("/api/csat", csatRoutes);
app.use("/api/export", exportRoutes);

// ─── Phase 6: Webhooks, Blocked contacts, Health, GDPR ───────────────────────
app.use("/api/admin/webhooks", requireRole("admin"), webhookAdminRoutes);
app.use("/api/admin/blocked", requireRole("admin"), blockedRoutes);
app.use("/api/admin/health", requireRole("admin"), healthRoutes);
app.use("/api/admin/gdpr", requireRole("admin"), gdprRoutes);

// ─── OAuth callback for Gmail token setup ────────────────────────────────────
app.get("/auth/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Missing code parameter");
  try {
    const { google } = await import("googleapis");
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token || "(no refresh token — try again with prompt=consent)";
    logger.info("Gmail OAuth refresh token obtained");
    res.send(`<h2>Gmail OAuth Success</h2><p>Refresh Token:</p><pre>${refreshToken}</pre><p>Copy this into your .env file as GMAIL_KYC_REFRESH_TOKEN or GMAIL_SUPPORT_REFRESH_TOKEN, then restart the server.</p>`);
  } catch (err) {
    logger.error("OAuth token exchange failed:", err);
    res.status(500).send("Token exchange failed. Check server logs.");
  }
});

// ─── Health check (unauthenticated) ──────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.issues });
    return;
  }
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : undefined,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const httpServer = createServer(app);
initWebSocket(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

syncService.start();
startSnoozeService();
startSlaService();
startReportScheduler();

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  syncService.stop();
  stopSnoozeService();
  stopSlaService();
  stopReportScheduler();
  httpServer.close(() => {
    logger.info("Server closed");
    prisma.$disconnect();
    process.exit(0);
  });
});

export default app;
