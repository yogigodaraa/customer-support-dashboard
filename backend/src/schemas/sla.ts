import { z } from "zod";

export const createSlaPolicySchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(["intercom", "gmail", "luciq", "*"]).default("*"),
  priority: z.enum(["critical", "high", "medium", "low", "*"]).default("*"),
  frtTargetMins: z.number().int().min(1).max(10080), // max 1 week
  resTargetMins: z.number().int().min(1).max(43200), // max 30 days
  isDefault: z.boolean().default(false),
});

export const updateSlaPolicySchema = createSlaPolicySchema.partial();

export const slaPolicyParamsSchema = z.object({
  id: z.string().cuid("Invalid policy ID"),
});
