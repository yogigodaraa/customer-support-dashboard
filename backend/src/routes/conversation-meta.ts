import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";
import { channelParamSchema, snoozeBodySchema, tagBodySchema } from "../schemas/meta.js";
import { noteBodySchema } from "../schemas/notes.js";
import { emitToChannel } from "../websocket.js";
import { z } from "zod";

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

// ─── Helper: get or create ConversationMeta ────────────────────────────────

async function upsertMeta(channel: string, externalId: string) {
  return prisma.conversationMeta.upsert({
    where: { channel_externalId: { channel, externalId } },
    create: { channel, externalId },
    update: {},
    include: {
      tags: { include: { tag: true } },
    },
  });
}

// ─── GET /api/meta/:channel/:externalId ────────────────────────────────────

router.get(
  "/",
  validate({ params: channelParamSchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;
    const meta = await upsertMeta(channel, externalId);
    res.json({
      id: meta.id,
      channel: meta.channel,
      externalId: meta.externalId,
      snoozedUntil: meta.snoozedUntil,
      firstResponseAt: meta.firstResponseAt,
      resolvedAt: meta.resolvedAt,
      slaBreachedAt: meta.slaBreachedAt,
      isPinned: meta.isPinned,
      priority: meta.priority,
      dueAt: meta.dueAt,
      tags: meta.tags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        color: ct.tag.color,
        addedAt: ct.addedAt,
      })),
    });
  }
);

// ─── POST /api/meta/:channel/:externalId/tags ──────────────────────────────

router.post(
  "/tags",
  validate({ params: channelParamSchema, body: tagBodySchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;
    const { tagId } = req.body as { tagId: string };
    const userId = (req as any).user?.userId as string;

    const meta = await upsertMeta(channel, externalId);

    await prisma.conversationTag.upsert({
      where: {
        conversationMetaId_tagId: {
          conversationMetaId: meta.id,
          tagId,
        },
      },
      create: {
        conversationMetaId: meta.id,
        tagId,
        addedByUserId: userId,
      },
      update: {},
    });

    emitToChannel(channel, "meta:tags_updated", { externalId });
    res.status(201).json({ ok: true });
  }
);

// ─── DELETE /api/meta/:channel/:externalId/tags/:tagId ────────────────────

const tagWithIdParamSchema = channelParamSchema.extend({ tagId: z.string().cuid() });

router.delete(
  "/tags/:tagId",
  validate({ params: tagWithIdParamSchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId, tagId } = req.params;

    const meta = await prisma.conversationMeta.findUnique({
      where: { channel_externalId: { channel, externalId } },
    });
    if (!meta) {
      res.status(404).json({ error: "Conversation meta not found" });
      return;
    }

    await prisma.conversationTag.deleteMany({
      where: { conversationMetaId: meta.id, tagId },
    });

    emitToChannel(channel, "meta:tags_updated", { externalId });
    res.status(204).end();
  }
);

// ─── POST /api/meta/:channel/:externalId/snooze ────────────────────────────

router.post(
  "/snooze",
  validate({ params: channelParamSchema, body: snoozeBodySchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;
    const { until } = req.body as { until: string };

    await prisma.conversationMeta.upsert({
      where: { channel_externalId: { channel, externalId } },
      create: { channel, externalId, snoozedUntil: new Date(until) },
      update: { snoozedUntil: new Date(until) },
    });

    emitToChannel(channel, "conversation:snoozed", {
      externalId,
      until,
    });
    res.json({ ok: true, snoozedUntil: until });
  }
);

// ─── DELETE /api/meta/:channel/:externalId/snooze ─────────────────────────

router.delete(
  "/snooze",
  validate({ params: channelParamSchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;

    await prisma.conversationMeta.upsert({
      where: { channel_externalId: { channel, externalId } },
      create: { channel, externalId, snoozedUntil: null },
      update: { snoozedUntil: null },
    });

    emitToChannel(channel, "conversation:unsnoozed", { externalId });
    res.status(204).end();
  }
);

// ─── GET /api/meta/:channel/:externalId/notes ─────────────────────────────

router.get(
  "/notes",
  validate({ params: channelParamSchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;

    const meta = await upsertMeta(channel, externalId);

    const notes = await prisma.internalNote.findMany({
      where: { conversationMetaId: meta.id },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(notes);
  }
);

// ─── POST /api/meta/:channel/:externalId/notes ────────────────────────────

router.post(
  "/notes",
  validate({ params: channelParamSchema, body: noteBodySchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;
    const { body: noteBody } = req.body as { body: string };
    const authorId = (req as any).user?.userId as string;

    const meta = await upsertMeta(channel, externalId);

    const note = await prisma.internalNote.create({
      data: {
        conversationMetaId: meta.id,
        authorId,
        body: noteBody,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    emitToChannel(channel, "note:updated", { externalId, noteId: note.id });
    res.status(201).json(note);
  }
);

// ─── PATCH /api/meta/:channel/:externalId/notes/:noteId ───────────────────

const noteWithIdParamSchema = channelParamSchema.extend({ noteId: z.string().cuid() });

router.patch(
  "/notes/:noteId",
  validate({ params: noteWithIdParamSchema, body: noteBodySchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId, noteId } = req.params;
    const { body: noteBody } = req.body as { body: string };
    const userId = (req as any).user?.userId as string;
    const userRole = (req as any).user?.role as string;

    const note = await prisma.internalNote.findUnique({ where: { id: noteId } });
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    if (note.authorId !== userId && userRole !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Only the author or admin can edit this note" });
      return;
    }

    const updated = await prisma.internalNote.update({
      where: { id: noteId },
      data: { body: noteBody },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    emitToChannel(channel, "note:updated", { externalId, noteId });
    res.json(updated);
  }
);

// ─── DELETE /api/meta/:channel/:externalId/notes/:noteId ──────────────────

router.delete(
  "/notes/:noteId",
  validate({ params: noteWithIdParamSchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId, noteId } = req.params;
    const userId = (req as any).user?.userId as string;
    const userRole = (req as any).user?.role as string;

    const note = await prisma.internalNote.findUnique({ where: { id: noteId } });
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    if (note.authorId !== userId && userRole !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Only the author or admin can delete this note" });
      return;
    }

    await prisma.internalNote.delete({ where: { id: noteId } });
    emitToChannel(channel, "note:updated", { externalId, noteId, deleted: true });
    res.status(204).end();
  }
);

// ─── PATCH /api/meta/:channel/:externalId/attributes ──────────────────────
// Sets isPinned, priority, dueAt on a conversation

const attributesSchema = z.object({
  isPinned: z.boolean().optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

router.patch(
  "/attributes",
  validate({ params: channelParamSchema, body: attributesSchema }),
  async (req: Request, res: Response) => {
    const { channel, externalId } = req.params;
    const { isPinned, priority, dueAt } = req.body as {
      isPinned?: boolean;
      priority?: string;
      dueAt?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (isPinned !== undefined) data.isPinned = isPinned;
    if (priority !== undefined) data.priority = priority;
    if (dueAt !== undefined) data.dueAt = dueAt ? new Date(dueAt) : null;

    const meta = await prisma.conversationMeta.upsert({
      where: { channel_externalId: { channel, externalId } },
      create: { channel, externalId, ...data },
      update: data,
    });

    emitToChannel(channel, "meta:attributes_updated", { externalId, ...data });
    res.json({ ok: true, isPinned: meta.isPinned, priority: meta.priority, dueAt: meta.dueAt });
  }
);

export default router;
