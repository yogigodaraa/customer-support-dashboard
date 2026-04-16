import { Router, Request, Response } from "express";
import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
import { emitToChannel } from "../websocket.js";

const router = Router();
const prisma = new PrismaClient();

// ─── Signature validation ─────────────────────────────────────────────────────

/**
 * Validate the Intercom webhook signature.
 * Intercom signs payloads with HMAC-SHA1 using the client secret as the key.
 * The signature is in the `X-Hub-Signature` header as `sha1=<hex>`.
 */
function verifyIntercomSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const [algo, provided] = signatureHeader.split("=");
  if (algo !== "sha1" || !provided) return false;

  const expected = createHmac("sha1", secret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Cache invalidation helper ────────────────────────────────────────────────

async function invalidateContactCache(identifiers: string[]) {
  for (const identifier of identifiers) {
    if (!identifier) continue;
    try {
      await prisma.cachedData.updateMany({
        where: { identifier, source: "intercom" },
        data: { expiresAt: new Date() }, // expire immediately
      });
      logger.info(`Cache invalidated for ${identifier}`);
    } catch (err) {
      logger.warn(`Cache invalidation failed for ${identifier}:`, err);
    }
  }
}

// ─── Webhook endpoint ─────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/intercom
 *
 * Receives Intercom webhook events and invalidates the relevant cache entries
 * so the next search always fetches fresh data.
 *
 * Configure Intercom to send webhooks to:
 *   https://your-backend.example.com/api/webhooks/intercom
 *
 * Supported topics:
 *   - conversation.created / replied / closed / assigned
 *   - contact.created / updated
 */
router.post(
  "/intercom",
  async (req: Request, res: Response) => {
    const webhookSecret = process.env.INTERCOM_WEBHOOK_SECRET;

    // Validate signature when a secret is configured
    if (webhookSecret) {
      const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody ??
        Buffer.from(JSON.stringify(req.body));

      const isValid = verifyIntercomSignature(
        rawBody,
        req.headers["x-hub-signature"] as string | undefined,
        webhookSecret
      );

      if (!isValid) {
        logger.warn("Intercom webhook signature validation failed");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    const { topic, data } = req.body as {
      topic?: string;
      data?: {
        item?: {
          id?: string;
          contacts?: { contacts: Array<{ id: string; email?: string }> };
          email?: string;
        };
      };
    };

    logger.info(`Intercom webhook received: ${topic}`);

    try {
      const item = data?.item;
      if (!item) {
        return res.status(200).json({ received: true });
      }

      const identifiersToInvalidate: string[] = [];

      if (topic?.startsWith("contact.")) {
        // contact.created, contact.updated
        if (item.id) identifiersToInvalidate.push(item.id);
        if (item.email) identifiersToInvalidate.push(item.email);
      }

      if (topic?.startsWith("conversation.")) {
        // conversation.created, conversation.replied, conversation.closed, conversation.assigned
        // Invalidate the cache for each contact on the conversation
        const contacts = item.contacts?.contacts ?? [];
        for (const c of contacts) {
          if (c.id) identifiersToInvalidate.push(c.id);
          if (c.email) identifiersToInvalidate.push(c.email);
        }
      }

      if (identifiersToInvalidate.length > 0) {
        await invalidateContactCache(identifiersToInvalidate);
      }

      // Emit WebSocket event for real-time updates
      if (topic?.startsWith("conversation.")) {
        emitToChannel("intercom", "conversation:updated", { topic, conversationId: item.id });
      }
    } catch (err) {
      // Log but still return 200 — Intercom retries on non-2xx responses
      logger.error("Webhook processing error:", err);
    }

    res.status(200).json({ received: true });
  }
);

export default router;
