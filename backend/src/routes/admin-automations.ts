import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { createRuleSchema, updateRuleSchema, ruleParamsSchema } from "../schemas/automation.js";

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/automations
router.get("/", async (_req: Request, res: Response) => {
  const rules = await prisma.automationRule.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rules);
});

// POST /api/admin/automations
router.post(
  "/",
  validate({ body: createRuleSchema }),
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const rule = await prisma.automationRule.create({
      data: { ...req.body, createdBy: userId },
    });
    res.status(201).json(rule);
  }
);

// PATCH /api/admin/automations/:id
router.patch(
  "/:id",
  validate({ params: ruleParamsSchema, body: updateRuleSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const rule = await prisma.automationRule.update({ where: { id }, data: req.body });
    res.json(rule);
  }
);

// DELETE /api/admin/automations/:id
router.delete(
  "/:id",
  validate({ params: ruleParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.automationRule.delete({ where: { id } });
    res.status(204).end();
  }
);

// PATCH /api/admin/automations/:id/toggle
router.patch(
  "/:id/toggle",
  validate({ params: ruleParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const rule = await prisma.automationRule.findUnique({ where: { id } });
    if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
    const updated = await prisma.automationRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
    res.json(updated);
  }
);

export default router;
