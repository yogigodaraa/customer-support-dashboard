import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { encrypt, mask } from "../utils/crypto.js";
import { validate } from "../middleware/validate.js";
import { serviceParamsSchema, updateIntegrationSchema } from "../schemas/admin.js";
import logger from "../utils/logger.js";

const router = Router();
const prisma = new PrismaClient();

const SERVICES = ["intercom", "gmail", "luciq", "retool"];

// GET /api/admin/integrations
router.get("/", async (_req: Request, res: Response) => {
  const keys = await prisma.integrationKey.findMany({
    orderBy: { service: "asc" },
  });

  // Return all services, with key info if configured
  const integrations = SERVICES.map(service => {
    const found = keys.find(k => k.service === service);
    return {
      service,
      configured: !!found,
      maskedKey: found ? mask(found.encryptedKey.split(":")[0] || "") : null,
      label: found?.label || null,
      lastRotated: found?.lastRotated || null,
    };
  });

  res.json({ integrations });
});

// PUT /api/admin/integrations/:service
router.put("/:service", validate({ params: serviceParamsSchema, body: updateIntegrationSchema }), async (req: Request, res: Response) => {
  const { service } = req.params;
  const { key, label } = req.body;

  const { encrypted: encryptedKey, iv } = encrypt(key.trim());

  const integration = await prisma.integrationKey.upsert({
    where: { service },
    create: { service, encryptedKey, iv, label: label || null, lastRotated: new Date() },
    update: { encryptedKey, iv, label: label || null, lastRotated: new Date() },
  });

  await prisma.auditLog.create({
    data: { userId: req.user!.userId, action: "rotate_integration_key", resource: service },
  }).catch(() => {});

  res.json({
    service: integration.service,
    configured: true,
    maskedKey: mask(key.trim()),
    label: integration.label,
    lastRotated: integration.lastRotated,
  });
});

export default router;
