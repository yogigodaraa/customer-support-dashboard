import { PrismaClient } from "@prisma/client";
import { emitToChannel } from "../websocket.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();
let snoozeTimer: ReturnType<typeof setInterval> | null = null;

async function wakeUpSnoozed(): Promise<void> {
  const now = new Date();

  const woken = await prisma.conversationMeta.findMany({
    where: {
      snoozedUntil: { lte: now },
    },
    select: { id: true, channel: true, externalId: true },
  });

  if (woken.length === 0) return;

  await prisma.conversationMeta.updateMany({
    where: { id: { in: woken.map((m) => m.id) } },
    data: { snoozedUntil: null },
  });

  for (const meta of woken) {
    emitToChannel(meta.channel, "conversation:unsnoozed", {
      externalId: meta.externalId,
    });
    logger.info(`Unsnoozed ${meta.channel}:${meta.externalId}`);
  }
}

export function startSnoozeService(): void {
  if (snoozeTimer) return;
  snoozeTimer = setInterval(() => {
    wakeUpSnoozed().catch((err) =>
      logger.error("Snooze wakeup error:", err)
    );
  }, 60_000); // every 60 seconds
  logger.info("Snooze service started");
}

export function stopSnoozeService(): void {
  if (snoozeTimer) {
    clearInterval(snoozeTimer);
    snoozeTimer = null;
    logger.info("Snooze service stopped");
  }
}

export default { startSnoozeService, stopSnoozeService };
