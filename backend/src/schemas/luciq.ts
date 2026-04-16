import { z } from "zod";

export const bugPatchSchema = z.object({
  status: z.enum(["open", "in_progress", "closed"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  assignee_email: z.string().optional(),
});

export const bugCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required").transform((s) => s.trim()),
  author_name: z.string().optional().default("Support Agent"),
  author_email: z.string().optional().default("support@wesupport.com.au"),
  is_internal: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true")
    .optional()
    .default(false),
});

export const bugParamsSchema = z.object({
  id: z.string().min(1),
});

export const bugQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  q: z.string().optional(),
});
