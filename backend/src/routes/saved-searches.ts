import { Router, Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().default(""),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const savedSearchParamsSchema = z.object({
  id: z.string().cuid("Invalid saved search ID"),
});

// GET /api/saved-searches — list user's saved searches
router.get("/", async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId as string;
  const searches = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(searches);
});

// POST /api/saved-searches — create saved search
router.post(
  "/",
  validate({ body: createSavedSearchSchema }),
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const { name, query, filters } = req.body as {
      name: string;
      query: string;
      filters?: Record<string, unknown>;
    };

    const saved = await prisma.savedSearch.create({
      data: {
        userId,
        name,
        query,
        filters: (filters ?? {}) as Prisma.InputJsonValue,
      },
    });
    res.status(201).json(saved);
  }
);

// DELETE /api/saved-searches/:id — delete saved search
router.delete(
  "/:id",
  validate({ params: savedSearchParamsSchema }),
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const { id } = req.params;

    const search = await prisma.savedSearch.findUnique({ where: { id } });
    if (!search) {
      res.status(404).json({ error: "Saved search not found" });
      return;
    }
    if (search.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await prisma.savedSearch.delete({ where: { id } });
    res.status(204).end();
  }
);

export default router;
