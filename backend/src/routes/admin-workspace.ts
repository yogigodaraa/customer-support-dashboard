import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { workspaceSettingsSchema } from "../schemas/workspace.js";

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/workspace — return all settings as { key: value }
router.get("/", async (_req: Request, res: Response) => {
  const settings = await prisma.workspaceSetting.findMany();
  const obj = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  res.json(obj);
});

// PATCH /api/admin/workspace — upsert settings
router.patch(
  "/",
  validate({ body: workspaceSettingsSchema }),
  async (req: Request, res: Response) => {
    const updates = req.body as Record<string, string>;
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.workspaceSetting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        })
      )
    );
    const all = await prisma.workspaceSetting.findMany();
    res.json(Object.fromEntries(all.map((s) => [s.key, s.value])));
  }
);

export default router;
