import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { bulkArchiveSchema, bulkAssignSchema, bulkTagSchema, bulkSnoozeSchema } from "../schemas/bulk.js";
import { emitToChannel } from "../websocket.js";
import logger from "../utils/logger.js";
import IntercomService from "../services/intercomService.js";
import GmailService from "../services/gmailService.js";

const intercom = new IntercomService(process.env.INTERCOM_ACCESS_TOKEN || "");
const gmail = new GmailService();

const router = Router();
const prisma = new PrismaClient();

// ─── Helper: upsert ConversationMeta for bulk ops ─────────────────────────

async function upsertManyMeta(channel: string, ids: string[]) {
  return Promise.all(
    ids.map((externalId) =>
      prisma.conversationMeta.upsert({
        where: { channel_externalId: { channel, externalId } },
        create: { channel, externalId },
        update: {},
      })
    )
  );
}

// ─── POST /api/bulk/archive ───────────────────────────────────────────────

router.post(
  "/archive",
  validate({ body: bulkArchiveSchema }),
  async (req: Request, res: Response) => {
    const { channel, ids } = req.body as { channel: string; ids: string[] };
    const adminId = (req as any).user?.userId as string;

    const results = { succeeded: [] as string[], failed: [] as string[] };

    for (const id of ids) {
      try {
        if (channel === "intercom") {
          await intercom.updateConversationState(id, "closed", adminId);
        } else if (channel === "gmail") {
          const gmailInbox = (req.body.gmailInbox as "support" | "kyc") ?? "support";
          await gmail.archive(gmailInbox, id);
        }
        // Luciq has no archive concept — skip
        results.succeeded.push(id);
      } catch (err) {
        logger.error(`Bulk archive failed for ${channel}:${id}`, err);
        results.failed.push(id);
      }
    }

    emitToChannel(channel, "bulk:archived", { ids: results.succeeded });
    res.json(results);
  }
);

// ─── POST /api/bulk/assign ────────────────────────────────────────────────

router.post(
  "/assign",
  validate({ body: bulkAssignSchema }),
  async (req: Request, res: Response) => {
    const { channel, ids, assigneeEmail } = req.body as {
      channel: string;
      ids: string[];
      assigneeEmail: string;
    };
    const adminId = (req as any).user?.userId as string;

    const results = { succeeded: [] as string[], failed: [] as string[] };

    for (const id of ids) {
      try {
        if (channel === "intercom") {
          // adminId = acting agent; assigneeEmail used as assigneeId here (simplification)
          await intercom.assignConversation(id, adminId, assigneeEmail);
        } else if (channel === "luciq") {
          // Luciq mock: would update in-memory
          logger.info(`Bulk assign luciq bug ${id} to ${assigneeEmail}`);
        }
        results.succeeded.push(id);
      } catch (err) {
        logger.error(`Bulk assign failed for ${channel}:${id}`, err);
        results.failed.push(id);
      }
    }

    emitToChannel(channel, "bulk:assigned", { ids: results.succeeded, assigneeEmail });
    res.json(results);
  }
);

// ─── POST /api/bulk/tag ───────────────────────────────────────────────────

router.post(
  "/tag",
  validate({ body: bulkTagSchema }),
  async (req: Request, res: Response) => {
    const { channel, ids, tagId } = req.body as {
      channel: string;
      ids: string[];
      tagId: string;
    };
    const userId = (req as any).user?.userId as string;

    // Verify tag exists
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }

    const metas = await upsertManyMeta(channel, ids);

    await prisma.conversationTag.createMany({
      data: metas.map((meta) => ({
        conversationMetaId: meta.id,
        tagId,
        addedByUserId: userId,
      })),
      skipDuplicates: true,
    });

    emitToChannel(channel, "bulk:tagged", { ids, tagId, tagName: tag.name });
    res.json({ ok: true, count: metas.length });
  }
);

// ─── POST /api/bulk/snooze ────────────────────────────────────────────────

router.post(
  "/snooze",
  validate({ body: bulkSnoozeSchema }),
  async (req: Request, res: Response) => {
    const { channel, ids, until } = req.body as {
      channel: string;
      ids: string[];
      until: string;
    };

    const snoozedUntil = new Date(until);
    const metas = await upsertManyMeta(channel, ids);

    await prisma.conversationMeta.updateMany({
      where: { id: { in: metas.map((m) => m.id) } },
      data: { snoozedUntil },
    });

    emitToChannel(channel, "bulk:snoozed", { ids, until });
    res.json({ ok: true, count: metas.length });
  }
);

export default router;
