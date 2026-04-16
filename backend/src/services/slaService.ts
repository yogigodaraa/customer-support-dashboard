import { PrismaClient } from "@prisma/client";
import { emitToChannel } from "../websocket.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

// ─── SLA status thresholds ─────────────────────────────────────────────────
// at_risk = within 20% of the target time remaining
const AT_RISK_THRESHOLD = 0.2;

function computeStatus(
  actualMins: number,
  targetMins: number
): "on_time" | "at_risk" | "breached" {
  if (actualMins > targetMins) return "breached";
  if (actualMins >= targetMins * (1 - AT_RISK_THRESHOLD)) return "at_risk";
  return "on_time";
}

// ─── Find matching policy for a conversation ──────────────────────────────

async function findPolicy(channel: string, priority = "*") {
  // Try exact match first, then channel wildcard, then full wildcard
  const policy = await prisma.slaPolicy.findFirst({
    where: {
      OR: [
        { channel, priority },
        { channel, priority: "*" },
        { channel: "*", priority: "*" },
        { isDefault: true },
      ],
    },
    orderBy: [
      { isDefault: "asc" }, // prefer non-default (more specific)
    ],
  });
  return policy;
}

// ─── recordFirstResponse ──────────────────────────────────────────────────
// Called when an agent sends the first reply in a conversation

export async function recordFirstResponse(
  channel: string,
  externalId: string,
  conversationCreatedAt: Date,
  priority?: string
): Promise<void> {
  const now = new Date();

  // Get or create meta
  const meta = await prisma.conversationMeta.upsert({
    where: { channel_externalId: { channel, externalId } },
    create: { channel, externalId, firstResponseAt: now },
    update: { firstResponseAt: { set: now } },
  });

  // Don't overwrite if already recorded
  if (meta.firstResponseAt && meta.firstResponseAt < now) return;

  const frtMins = Math.floor((now.getTime() - conversationCreatedAt.getTime()) / 60000);
  const policy = await findPolicy(channel, priority);

  let frtStatus: "on_time" | "at_risk" | "breached" | undefined;
  if (policy) {
    frtStatus = computeStatus(frtMins, policy.frtTargetMins);
    if (frtStatus === "breached") {
      await prisma.conversationMeta.update({
        where: { id: meta.id },
        data: { slaBreachedAt: now },
      });
      emitToChannel(channel, "sla:breached", { externalId, type: "frt" });
    }
  }

  await prisma.slaSnapshot.create({
    data: {
      conversationMetaId: meta.id,
      policyId: policy?.id,
      frtMins,
      frtStatus,
    },
  });

  logger.info(`SLA: FRT recorded for ${channel}:${externalId} — ${frtMins}min (${frtStatus ?? "no policy"})`);
}

// ─── recordResolution ─────────────────────────────────────────────────────
// Called when a conversation is resolved/closed

export async function recordResolution(
  channel: string,
  externalId: string,
  conversationCreatedAt: Date,
  priority?: string
): Promise<void> {
  const now = new Date();

  const meta = await prisma.conversationMeta.upsert({
    where: { channel_externalId: { channel, externalId } },
    create: { channel, externalId, resolvedAt: now },
    update: { resolvedAt: now },
  });

  const resMins = Math.floor((now.getTime() - conversationCreatedAt.getTime()) / 60000);
  const policy = await findPolicy(channel, priority);

  let resStatus: "on_time" | "at_risk" | "breached" | undefined;
  if (policy) {
    resStatus = computeStatus(resMins, policy.resTargetMins);
    if (resStatus === "breached") {
      emitToChannel(channel, "sla:breached", { externalId, type: "resolution" });
    }
  }

  // Upsert the snapshot (update existing FRT snapshot if possible)
  const existing = await prisma.slaSnapshot.findFirst({
    where: { conversationMetaId: meta.id },
    orderBy: { recordedAt: "desc" },
  });

  if (existing) {
    await prisma.slaSnapshot.update({
      where: { id: existing.id },
      data: { resMins, resStatus },
    });
  } else {
    await prisma.slaSnapshot.create({
      data: {
        conversationMetaId: meta.id,
        policyId: policy?.id,
        resMins,
        resStatus,
      },
    });
  }

  logger.info(`SLA: Resolution recorded for ${channel}:${externalId} — ${resMins}min (${resStatus ?? "no policy"})`);
}

// ─── checkSlaStatus ───────────────────────────────────────────────────────
// Returns current SLA status for a conversation

export async function checkSlaStatus(
  channel: string,
  externalId: string
): Promise<{
  frt: { targetMins: number | null; actualMins: number | null; status: string };
  resolution: { targetMins: number | null; actualMins: number | null; status: string };
}> {
  const meta = await prisma.conversationMeta.findUnique({
    where: { channel_externalId: { channel, externalId } },
    include: {
      slaSnapshots: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
  });

  const snap = meta?.slaSnapshots?.[0];
  const policy = await findPolicy(channel);

  return {
    frt: {
      targetMins: policy?.frtTargetMins ?? null,
      actualMins: snap?.frtMins ?? null,
      status: snap?.frtStatus ?? "unknown",
    },
    resolution: {
      targetMins: policy?.resTargetMins ?? null,
      actualMins: snap?.resMins ?? null,
      status: snap?.resStatus ?? "unknown",
    },
  };
}

// ─── SLA warning cron ─────────────────────────────────────────────────────
// Checks for conversations approaching breach every 5 minutes

let slaTimer: ReturnType<typeof setInterval> | null = null;

async function checkApproachingBreaches(): Promise<void> {
  const policies = await prisma.slaPolicy.findMany();
  if (policies.length === 0) return;

  // For each policy, find conversations that are at_risk
  for (const policy of policies) {
    const warningCutoff = new Date(Date.now() - (policy.frtTargetMins * 0.8) * 60000);
    // Conversations created before the warning cutoff but no first response
    const atRisk = await prisma.conversationMeta.findMany({
      where: {
        channel: policy.channel === "*" ? undefined : policy.channel,
        firstResponseAt: null,
        createdAt: { lte: warningCutoff },
        slaBreachedAt: null,
      },
      take: 50,
    });

    for (const meta of atRisk) {
      emitToChannel(meta.channel, "sla:warning", {
        externalId: meta.externalId,
        type: "frt",
        targetMins: policy.frtTargetMins,
      });
    }
  }
}

export function startSlaService(): void {
  if (slaTimer) return;
  slaTimer = setInterval(() => {
    checkApproachingBreaches().catch((err) =>
      logger.error("SLA warning check error:", err)
    );
  }, 5 * 60_000); // every 5 minutes
  logger.info("SLA service started");
}

export function stopSlaService(): void {
  if (slaTimer) {
    clearInterval(slaTimer);
    slaTimer = null;
  }
}
