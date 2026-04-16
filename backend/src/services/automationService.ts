import { PrismaClient } from "@prisma/client";
import { emitToUser, emitToChannel } from "../websocket.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

export interface AutomationContext {
  channel?: string;
  externalId?: string;
  agentId?: string;
  tagId?: string;
  kycCaseId?: string;
  priority?: string;
  riskLevel?: string;
}

export async function executeRules(
  trigger: string,
  ctx: AutomationContext
): Promise<void> {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { trigger, isActive: true },
    });

    for (const rule of rules) {
      try {
        // Filter by triggerConfig
        const cfg = rule.triggerConfig as Record<string, string> | null;
        if (cfg) {
          if (cfg.channel && ctx.channel && cfg.channel !== ctx.channel) continue;
          if (cfg.tagId && ctx.tagId && cfg.tagId !== ctx.tagId) continue;
          if (cfg.priority && ctx.priority && cfg.priority !== ctx.priority) continue;
          if (cfg.riskLevel && ctx.riskLevel && cfg.riskLevel !== ctx.riskLevel) continue;
        }

        // Execute each action
        const actions = rule.actions as Array<{ type: string; params?: Record<string, unknown> }>;
        for (const action of actions) {
          await executeAction(action.type, action.params ?? {}, ctx, rule.name);
        }

        // Update run stats
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { runCount: { increment: 1 }, lastRunAt: new Date() },
        });
      } catch (err) {
        logger.error(`Automation rule ${rule.id} execution failed:`, err);
      }
    }
  } catch (err) {
    logger.error("executeRules failed:", err);
  }
}

async function executeAction(
  type: string,
  params: Record<string, unknown>,
  ctx: AutomationContext,
  ruleName: string
): Promise<void> {
  switch (type) {
    case "add_tag": {
      if (!ctx.channel || !ctx.externalId || !params.tagId) break;
      const tagId = params.tagId as string;
      const meta = await prisma.conversationMeta.upsert({
        where: { channel_externalId: { channel: ctx.channel, externalId: ctx.externalId } },
        create: { channel: ctx.channel, externalId: ctx.externalId },
        update: {},
      });
      await prisma.conversationTag.upsert({
        where: { conversationMetaId_tagId: { conversationMetaId: meta.id, tagId } },
        create: { conversationMetaId: meta.id, tagId },
        update: {},
      });
      break;
    }
    case "notify_agent": {
      const agentId = (params.agentId as string) ?? ctx.agentId;
      if (!agentId) break;
      emitToUser(agentId, "automation:notification", {
        ruleName,
        message: params.message ?? `Automation rule "${ruleName}" triggered`,
        channel: ctx.channel,
        externalId: ctx.externalId,
      });
      break;
    }
    case "escalate_kyc": {
      const caseId = (params.kycCaseId as string) ?? ctx.kycCaseId;
      if (!caseId) break;
      await prisma.kycCase.update({
        where: { id: caseId },
        data: { status: "escalated" },
      });
      emitToChannel("kyc", "kyc:status_changed", {
        caseId,
        fromStatus: "in_review",
        toStatus: "escalated",
      });
      break;
    }
    case "close_conversation": {
      if (!ctx.channel || !ctx.externalId) break;
      emitToChannel(ctx.channel, "automation:close", { externalId: ctx.externalId });
      break;
    }
    default:
      logger.info(`Automation: unknown action type "${type}"`);
  }
}
