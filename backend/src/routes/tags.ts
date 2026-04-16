import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createTagSchema, updateTagSchema, tagParamsSchema } from "../schemas/tags.js";

const router = Router();
const prisma = new PrismaClient();

// GET /api/tags — list all tags
router.get("/", async (_req: Request, res: Response) => {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
  });
  res.json(tags);
});

// POST /api/tags — create tag (agent+)
router.post(
  "/",
  validate({ body: createTagSchema }),
  async (req: Request, res: Response) => {
    const { name, color } = req.body as { name: string; color?: string };
    const tag = await prisma.tag.create({
      data: { name, color: color ?? "#6B7280" },
    });
    res.status(201).json(tag);
  }
);

// PATCH /api/tags/:id — update tag (admin only)
router.patch(
  "/:id",
  requireRole("admin"),
  validate({ params: tagParamsSchema, body: updateTagSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body as { name?: string; color?: string };
    const tag = await prisma.tag.update({
      where: { id },
      data,
    });
    res.json(tag);
  }
);

// DELETE /api/tags/:id — delete tag (admin only)
router.delete(
  "/:id",
  requireRole("admin"),
  validate({ params: tagParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.tag.delete({ where: { id } });
    res.status(204).end();
  }
);

export default router;
