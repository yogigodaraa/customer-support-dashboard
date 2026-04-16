import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

const blockSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().optional(),
  reason: z.string().max(300).optional(),
}).refine(d => d.email || d.userId, { message: "email or userId required" });

// GET /api/admin/blocked
router.get("/", async (_req: Request, res: Response) => {
  const contacts = await prisma.blockedContact.findMany({ orderBy: { createdAt: "desc" } });
  res.json(contacts);
});

// POST /api/admin/blocked
router.post("/", async (req: Request, res: Response) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { email, userId, reason } = parsed.data;
  try {
    const contact = await prisma.blockedContact.create({
      data: { email, userId, reason, blockedBy: req.user!.userId },
    });
    res.status(201).json(contact);
  } catch {
    res.status(409).json({ error: "Contact already blocked" });
  }
});

// DELETE /api/admin/blocked/:id
router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.blockedContact.delete({ where: { id: req.params.id } }).catch(() => {});
  res.json({ ok: true });
});

export default router;
