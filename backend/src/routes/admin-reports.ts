import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import * as cron from "node-cron";
import { sendReport, reloadReport } from "../services/reportService.js";

const router = Router();
const prisma = new PrismaClient();

const reportSchema = z.object({
  name: z.string().min(1).max(200),
  schedule: z.string().refine((s) => cron.validate(s), { message: "Invalid cron expression" }),
  metrics: z.array(z.string()).min(1),
  recipients: z.array(z.string().email()).min(1),
  isActive: z.boolean().default(true),
});

const paramsSchema = z.object({ id: z.string().cuid() });

// GET /api/admin/reports
router.get("/", async (_req: Request, res: Response) => {
  const reports = await prisma.scheduledReport.findMany({ orderBy: { createdAt: "desc" } });
  res.json(reports);
});

// POST /api/admin/reports
router.post("/", async (req: Request, res: Response) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const userId = (req as any).user?.userId as string;
  const report = await prisma.scheduledReport.create({
    data: { ...parsed.data, createdBy: userId },
  });
  await reloadReport(report.id);
  res.status(201).json(report);
});

// PATCH /api/admin/reports/:id
router.patch("/:id", async (req: Request, res: Response) => {
  const { id } = paramsSchema.parse(req.params);
  const parsed = reportSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const report = await prisma.scheduledReport.update({ where: { id }, data: parsed.data });
  await reloadReport(id);
  res.json(report);
});

// DELETE /api/admin/reports/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = paramsSchema.parse(req.params);
  await prisma.scheduledReport.delete({ where: { id } });
  await reloadReport(id); // will cancel the task since record is gone
  res.status(204).end();
});

// POST /api/admin/reports/:id/send-now
router.post("/:id/send-now", async (req: Request, res: Response) => {
  const { id } = paramsSchema.parse(req.params);
  await sendReport(id);
  res.json({ ok: true, sentAt: new Date().toISOString() });
});

export default router;
