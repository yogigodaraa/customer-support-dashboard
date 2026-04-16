import { Router, Request, Response } from "express";
import GmailService, { GmailChannel } from "../services/gmailService.js";
import logger from "../utils/logger.js";
import { emitToChannel } from "../websocket.js";
import { recordFirstResponse } from "../services/slaService.js";
import { validate } from "../middleware/validate.js";
import {
  gmailReplySchema,
  gmailComposeSchema,
  gmailDraftSchema,
  threadParamsSchema,
  draftParamsSchema,
} from "../schemas/gmail.js";

const router = Router();
const gmail = new GmailService();

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseChannel(req: Request): GmailChannel {
  const ch = ((req.query.channel || req.body?.channel) as string)?.toLowerCase();
  if (ch === "kyc" || ch === "support") return ch;
  return "support";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Thread listing ─────────────────────────────────────────────────────────────

// GET /api/gmail/threads?channel=kyc|support&status=inbox|archived|spam|trash|promotions|drafts&q=search
router.get("/threads", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  if (!gmail.hasChannel(channel)) {
    return res.json({ conversations: [], total: 0, counts: { all: 0, inbox: 0, archived: 0, spam: 0, trash: 0, promotions: 0, drafts: 0 } });
  }

  try {
    const q = req.query.q as string | undefined;
    const label = req.query.status as string | undefined;

    // Drafts use a separate API
    if (label === "drafts") {
      const result = await gmail.listDrafts(channel);
      const conversations = result.drafts.map(d => ({
        id: d.id,
        subject: d.subject,
        status: "draft" as const,
        assignee: null,
        recipient: { name: d.to, email: d.to },
        last_message_at: d.updatedAt,
        last_message_preview: d.snippet,
        is_read: true,
        tags: [],
        inbox: channel === "kyc" ? "KYC" : "Support",
        time_ago: timeAgo(d.updatedAt),
        isDraft: true,
      }));

      return res.json({
        conversations,
        total: result.total,
        counts: { all: 0, inbox: 0, archived: 0, spam: 0, trash: 0, promotions: 0, drafts: result.total },
      });
    }

    const result = await gmail.listThreads(channel, { q, label });

    const conversations = result.threads.map(t => ({
      id: t.id,
      subject: t.subject,
      status: t.isUnread ? "inbox" : "inbox" as "inbox" | "archived",
      assignee: null,
      recipient: t.from,
      last_message_at: t.lastMessageAt,
      last_message_preview: t.snippet,
      is_read: !t.isUnread,
      tags: [],
      inbox: channel === "kyc" ? "KYC" : "Support",
      time_ago: timeAgo(t.lastMessageAt),
    }));

    const inbox = conversations.length;
    res.json({
      conversations,
      total: result.total,
      counts: { all: result.total, inbox, archived: 0, spam: 0, trash: 0, promotions: 0, drafts: 0 },
    });
  } catch (error) {
    logger.error("Error fetching Gmail threads:", error);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// ─── Thread detail ──────────────────────────────────────────────────────────────

// GET /api/gmail/threads/:id?channel=kyc|support
router.get("/threads/:id", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    const thread = await gmail.getThread(channel, req.params.id);

    res.json({
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      assignee: null,
      recipient: thread.from,
      last_message_at: thread.lastMessageAt,
      last_message_preview: thread.snippet,
      is_read: true,
      tags: [],
      inbox: channel === "kyc" ? "KYC" : "Support",
      time_ago: timeAgo(thread.lastMessageAt),
      messages: thread.messages,
    });
  } catch (error) {
    logger.error("Error fetching Gmail thread:", error);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// ─── Attachment download ─────────────────────────────────────────────────────────

// GET /api/gmail/attachments/:messageId/:attachmentId?channel=support&filename=...&mimeType=...
router.get("/attachments/:messageId/:attachmentId", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  const { messageId, attachmentId } = req.params;
  const filename = (req.query.filename as string) || "attachment";
  const mimeType = (req.query.mimeType as string) || "application/octet-stream";

  if (!gmail.hasChannel(channel)) {
    res.status(503).json({ error: "Gmail not configured" });
    return;
  }
  try {
    const data = await gmail.getAttachment(channel, messageId, attachmentId);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Length", data.length);
    res.send(data);
  } catch (error) {
    logger.error("Attachment fetch failed:", error);
    res.status(500).json({ error: "Failed to fetch attachment" });
  }
});

// ─── Reply ──────────────────────────────────────────────────────────────────────

// POST /api/gmail/threads/:id/reply
router.post(
  "/threads/:id/reply",
  validate({ params: threadParamsSchema, body: gmailReplySchema }),
  async (req: Request, res: Response) => {
    const { body, channel } = req.body;
    try {
      await gmail.sendReply(channel, req.params.id, body);
      emitToChannel(`gmail:${channel}`, "conversation:updated", { threadId: req.params.id, action: "reply" });
      recordFirstResponse("gmail", req.params.id, new Date(Date.now() - 60000)).catch(() => {});
      res.json({ ok: true });
    } catch (error) {
      logger.error("Gmail reply failed:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  }
);

// ─── Archive ────────────────────────────────────────────────────────────────────

// PATCH /api/gmail/threads/:id/archive
router.patch("/threads/:id/archive", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    await gmail.archive(channel, req.params.id);
    emitToChannel(`gmail:${channel}`, "conversation:updated", { threadId: req.params.id, action: "archive" });
    res.json({ ok: true });
  } catch (error) {
    logger.error("Gmail archive failed:", error);
    res.status(500).json({ error: "Failed to archive thread" });
  }
});

// ─── Compose new email ──────────────────────────────────────────────────────────

// POST /api/gmail/compose
router.post(
  "/compose",
  validate({ body: gmailComposeSchema }),
  async (req: Request, res: Response) => {
    const { to, subject, body, channel } = req.body;
    try {
      const messageId = await gmail.sendNewEmail(channel, to, subject, body);
      emitToChannel(`gmail:${channel}`, "conversation:new", { messageId, action: "compose" });
      res.json({ ok: true, messageId });
    } catch (error) {
      logger.error("Gmail compose failed:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  }
);

// ─── Drafts ─────────────────────────────────────────────────────────────────────

// POST /api/gmail/drafts
router.post(
  "/drafts",
  validate({ body: gmailDraftSchema }),
  async (req: Request, res: Response) => {
    const { to, subject, body, channel } = req.body;
    try {
      const draftId = await gmail.createDraft(channel, to, subject, body);
      res.json({ ok: true, draftId });
    } catch (error) {
      logger.error("Gmail create draft failed:", error);
      res.status(500).json({ error: "Failed to create draft" });
    }
  }
);

// PUT /api/gmail/drafts/:id
router.put(
  "/drafts/:id",
  validate({ params: draftParamsSchema, body: gmailDraftSchema }),
  async (req: Request, res: Response) => {
    const { to, subject, body, channel } = req.body;
    try {
      await gmail.updateDraft(channel, req.params.id, to, subject, body);
      res.json({ ok: true });
    } catch (error) {
      logger.error("Gmail update draft failed:", error);
      res.status(500).json({ error: "Failed to update draft" });
    }
  }
);

// GET /api/gmail/drafts/:id
router.get("/drafts/:id", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    const draft = await gmail.getDraft(channel, req.params.id);
    res.json(draft);
  } catch (error) {
    logger.error("Gmail get draft failed:", error);
    res.status(500).json({ error: "Failed to get draft" });
  }
});

// POST /api/gmail/drafts/:id/send
router.post("/drafts/:id/send", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    await gmail.sendDraft(channel, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    logger.error("Gmail send draft failed:", error);
    res.status(500).json({ error: "Failed to send draft" });
  }
});

// DELETE /api/gmail/drafts/:id
router.delete("/drafts/:id", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    await gmail.deleteDraft(channel, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    logger.error("Gmail delete draft failed:", error);
    res.status(500).json({ error: "Failed to delete draft" });
  }
});

// ─── Trash / Spam ───────────────────────────────────────────────────────────────

// PATCH /api/gmail/threads/:id/trash
router.patch("/threads/:id/trash", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    await gmail.moveToTrash(channel, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    logger.error("Gmail trash failed:", error);
    res.status(500).json({ error: "Failed to move to trash" });
  }
});

// PATCH /api/gmail/threads/:id/untrash
router.patch("/threads/:id/untrash", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    await gmail.untrash(channel, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    logger.error("Gmail untrash failed:", error);
    res.status(500).json({ error: "Failed to restore from trash" });
  }
});

// PATCH /api/gmail/threads/:id/spam
router.patch("/threads/:id/spam", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    await gmail.markSpam(channel, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    logger.error("Gmail mark spam failed:", error);
    res.status(500).json({ error: "Failed to mark as spam" });
  }
});

// PATCH /api/gmail/threads/:id/unspam
router.patch("/threads/:id/unspam", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  try {
    await gmail.unspam(channel, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    logger.error("Gmail unspam failed:", error);
    res.status(500).json({ error: "Failed to remove from spam" });
  }
});

// ─── Stats ──────────────────────────────────────────────────────────────────────

// GET /api/gmail/stats?channel=kyc|support
router.get("/stats", async (req: Request, res: Response) => {
  const channel = parseChannel(req);
  if (!gmail.hasChannel(channel)) {
    return res.json({ inbox: 0, unread: 0, newLast7Days: 0 });
  }
  try {
    const stats = await gmail.getConversationStats(channel);
    res.json(stats);
  } catch (error) {
    logger.error("Gmail stats failed:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
