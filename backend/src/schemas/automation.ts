import { z } from "zod";

const TRIGGER_TYPES = [
  "conversation_opened",
  "message_received",
  "sla_at_risk",
  "kyc_created",
  "tag_added",
  "conversation_assigned",
] as const;

const ACTION_TYPES = [
  "add_tag",
  "notify_agent",
  "escalate_kyc",
  "close_conversation",
] as const;

export const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  trigger: z.enum(TRIGGER_TYPES),
  triggerConfig: z
    .object({
      channel: z.string().optional(),
      tagId: z.string().optional(),
      priority: z.string().optional(),
      riskLevel: z.string().optional(),
    })
    .optional(),
  actions: z
    .array(
      z.object({
        type: z.enum(ACTION_TYPES),
        params: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1),
});

export const updateRuleSchema = createRuleSchema.partial();

export const ruleParamsSchema = z.object({
  id: z.string().cuid("Invalid rule ID"),
});
