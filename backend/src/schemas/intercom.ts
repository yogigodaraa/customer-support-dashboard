import { z } from "zod";

export const intercomListQuerySchema = z.object({
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().positive().max(100).optional().default(20),
  q: z.string().optional(),
});

export const replyBodySchema = z.object({
  body: z.string().min(1, "body is required").transform((s) => s.trim()),
  admin_id: z.string().min(1, "admin_id is required"),
});

export const stateUpdateBodySchema = z.object({
  state: z.enum(["open", "closed", "snoozed"]),
  admin_id: z.string().min(1, "admin_id is required"),
  snooze_until: z.number().optional(),
});

export const assignBodySchema = z.object({
  admin_id: z.string().min(1),
  assignee_id: z.string().min(1),
});

export const noteBodySchema = z.object({
  body: z.string().min(1),
  admin_id: z.string().min(1),
});

export const conversationParamsSchema = z.object({
  id: z.string().min(1),
});
