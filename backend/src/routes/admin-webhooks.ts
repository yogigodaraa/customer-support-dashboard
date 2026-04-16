import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";
import axios from "axios";

const router = Router();
const prisma = new PrismaClient();

const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/webhooks
router.get("/", async (_req: Request, res: Response) => {
  const webhooks = await prisma.webhook.findMany({ orderBy: { createdAt: "desc" } });
  res.json(webhooks);
});

// POST /api/admin/webhooks
router.post("/", async (req: Request, res: Response) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { name, url, events, secret, isActive } = parsed.data;
  const webhook = await prisma.webhook.create({
    data: {
      name,
      url,
      events,
      secret: secret || crypto.randomBytes(20).toString("hex"),
      isActive: isActive ?? true,
    },
  });
  res.status(201).json(webhook);
});

// PATCH /api/admin/webhooks/:id
router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = webhookSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const webhook = await prisma.webhook.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(webhook);
});

// DELETE /api/admin/webhooks/:id
router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.webhook.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// POST /api/admin/webhooks/:id/test — ping the webhook URL
router.post("/:id/test", async (req: Request, res: Response) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!webhook) return res.status(404).json({ error: "Not found" });

  const payload = { event: "test.ping", timestamp: new Date().toISOString(), webhook: webhook.name };
  const body = JSON.stringify(payload);
  const sig = webhook.secret
    ? crypto.createHmac("sha256", webhook.secret).update(body).digest("hex")
    : undefined;

  const start = Date.now();
  try {
    await axios.post(webhook.url, payload, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        ...(sig ? { "X-Webhook-Signature": `sha256=${sig}` } : {}),
      },
    });
    const ms = Date.now() - start;
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { lastPingedAt: new Date(), lastStatus: "ok" },
    });
    res.json({ ok: true, ms });
  } catch (err: unknown) {
    const ms = Date.now() - start;
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { lastPingedAt: new Date(), lastStatus: "failed" },
    });
    const msg = err instanceof Error ? err.message : "Request failed";
    res.status(502).json({ ok: false, ms, error: msg });
  }
});

export default router;
