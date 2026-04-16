import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { teamSchema, teamMemberSchema, teamParamsSchema, teamMemberParamsSchema } from "../schemas/workspace.js";

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/teams
router.get("/", async (_req: Request, res: Response) => {
  const teams = await prisma.team.findMany({
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(teams);
});

// POST /api/admin/teams
router.post(
  "/",
  validate({ body: teamSchema }),
  async (req: Request, res: Response) => {
    const team = await prisma.team.create({ data: req.body });
    res.status(201).json(team);
  }
);

// PATCH /api/admin/teams/:id
router.patch(
  "/:id",
  validate({ params: teamParamsSchema, body: teamSchema.partial() }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const team = await prisma.team.update({ where: { id }, data: req.body });
    res.json(team);
  }
);

// DELETE /api/admin/teams/:id
router.delete(
  "/:id",
  validate({ params: teamParamsSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.team.delete({ where: { id } });
    res.status(204).end();
  }
);

// POST /api/admin/teams/:id/members
router.post(
  "/:id/members",
  validate({ params: teamParamsSchema, body: teamMemberSchema }),
  async (req: Request, res: Response) => {
    const { id: teamId } = req.params;
    const { userId, role } = req.body as { userId: string; role: string };

    // Verify team exists
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const member = await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId, role },
      update: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json(member);
  }
);

// DELETE /api/admin/teams/:id/members/:userId
router.delete(
  "/:id/members/:userId",
  validate({ params: teamMemberParamsSchema }),
  async (req: Request, res: Response) => {
    const { id: teamId, userId } = req.params;
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    res.status(204).end();
  }
);

export default router;
