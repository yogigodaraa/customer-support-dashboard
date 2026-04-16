import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createSlaPolicySchema,
  updateSlaPolicySchema,
  slaPolicyParamsSchema,
} from "../schemas/sla.js";
import { checkSlaStatus } from "../services/slaService.js";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// GET /api/sla/policies — list all SLA policies
router.get("/policies", async (_req: Request, res: Response) => {
  const policies = await prisma.slaPolicy.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  res.json(policies);
});

// POST /api/sla/policies — create policy (admin only)
router.post(
  "/policies",
  requireRole("admin"),
  validate({ body: createSlaPolicySchema }),
  async (req: Request, res: Response) => {
    const data = req.body;

    // If marking as default, unset others first
    if (data.isDefault) {
      await prisma.slaPolicy.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.slaPolicy.create({ data });
    res.status(201).json(policy);
  }
);

// PATCH /api/sla/policies/:id — update policy (admin only)
router.patch(
  "/policies/:id",
  requireRole("admin"),
  validate({ params: slaPolicyParamsSchema, body: updateSlaPolicySchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;

    if (data.isDefault) {
      await prisma.slaPolicy.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.slaPolicy.update({ where: { id }, data });
    res.json(policy);
  }
);

// DELETE /api/sla/policies/:id — delete policy (admin only)
router.delete(
  "/policies/:id",
  requireRole("admin"),
  validate({ params: slaPolicyParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.slaPolicy.delete({ where: { id } });
    res.status(204).end();
  }
);

// GET /api/sla/status/:channel/:externalId — get SLA status for a conversation
const slaStatusParamSchema = z.object({
  channel: z.enum(["intercom", "gmail", "luciq"]),
  externalId: z.string().min(1),
});

router.get(
  "/status/:channel/:externalId",
  validate({ params: slaStatusParamSchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;
    const status = await checkSlaStatus(channel, externalId);
    res.json(status);
  }
);

export default router;
