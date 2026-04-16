import { PrismaClient } from "@prisma/client";
import * as cron from "node-cron";
import nodemailer from "nodemailer";
import logger from "../utils/logger.js";
import dashboardService from "./dashboardService.js";

const prisma = new PrismaClient();

const scheduledTasks = new Map<string, cron.ScheduledTask>();

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function formatReportHtml(stats: Awaited<ReturnType<typeof dashboardService.getStats>>, reportName: string): string {
  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937; }
  h1 { color: #6366f1; font-size: 22px; }
  .metric { display: inline-block; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 20px; margin: 8px; text-align: center; }
  .metric .value { font-size: 24px; font-weight: bold; color: #111827; }
  .metric .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .footer { font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style></head>
<body>
  <h1>📊 ${reportName}</h1>
  <p style="color:#6b7280">Generated ${new Date().toLocaleDateString("en-AU", { dateStyle: "full" })}</p>
  <div>
    <div class="metric"><div class="value">${stats.summary.openCases}</div><div class="label">Open Cases</div></div>
    <div class="metric"><div class="value">${stats.summary.pendingEmails}</div><div class="label">Pending Emails</div></div>
    <div class="metric"><div class="value">${stats.summary.repliedLast7Days}</div><div class="label">Replied (7d)</div></div>
    <div class="metric"><div class="value">${stats.slaHealth.onTime}%</div><div class="label">SLA On-Time</div></div>
    <div class="metric"><div class="value">${stats.kycStats.pending}</div><div class="label">KYC Pending</div></div>
  </div>
  <p style="margin-top:24px">
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
      View Dashboard →
    </a>
  </p>
  <div class="footer">WeSupport · Automated Report · <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin">Manage Reports</a></div>
</body>
</html>`;
}

export async function sendReport(reportId: string): Promise<void> {
  const report = await prisma.scheduledReport.findUnique({ where: { id: reportId } });
  if (!report) return;

  const stats = await dashboardService.getStats();
  const html = formatReportHtml(stats, report.name);
  const recipients = report.recipients as string[];

  const transport = getTransport();
  if (!transport) {
    logger.info(`[Report: ${report.name}] SMTP not configured. Email content:\n${html.replace(/<[^>]+>/g, "").slice(0, 300)}...`);
  } else {
    await transport.sendMail({
      from: process.env.SMTP_FROM || "WeSupport <noreply@wesupport.io>",
      to: recipients.join(", "),
      subject: `📊 WeSupport Report: ${report.name}`,
      html,
    });
    logger.info(`[Report: ${report.name}] Sent to ${recipients.join(", ")}`);
  }

  await prisma.scheduledReport.update({ where: { id: reportId }, data: { lastSentAt: new Date() } });
}

export async function reloadReport(reportId: string): Promise<void> {
  // Cancel existing task if any
  const existing = scheduledTasks.get(reportId);
  if (existing) { existing.stop(); scheduledTasks.delete(reportId); }

  const report = await prisma.scheduledReport.findUnique({ where: { id: reportId } });
  if (!report || !report.isActive) return;
  if (!cron.validate(report.schedule)) {
    logger.warn(`Report ${reportId} has invalid cron: ${report.schedule}`);
    return;
  }

  const task = cron.schedule(report.schedule, () => {
    sendReport(reportId).catch((err) => logger.error(`Report ${reportId} send failed:`, err));
  });
  scheduledTasks.set(reportId, task);
  logger.info(`Report "${report.name}" scheduled: ${report.schedule}`);
}

export async function startReportScheduler(): Promise<void> {
  const reports = await prisma.scheduledReport.findMany({ where: { isActive: true } });
  await Promise.all(reports.map((r) => reloadReport(r.id)));
  logger.info(`Report scheduler started (${reports.length} active reports)`);
}

export function stopReportScheduler(): void {
  for (const [id, task] of scheduledTasks.entries()) {
    task.stop();
    scheduledTasks.delete(id);
  }
  logger.info("Report scheduler stopped");
}
