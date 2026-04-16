import { z } from "zod";

export const gmailChannelQuerySchema = z.object({
  channel: z.enum(["kyc", "support"]).optional().default("support"),
  q: z.string().optional(),
  status: z.string().optional(),
});

export const gmailReplySchema = z.object({
  body: z.string().min(1, "body is required").transform((s) => s.trim()),
  channel: z.enum(["kyc", "support"]).optional().default("support"),
});

export const gmailComposeSchema = z.object({
  to: z.string().email().transform((s) => s.trim()),
  subject: z.string().min(1, "subject is required").transform((s) => s.trim()),
  body: z.string().min(1, "body is required").transform((s) => s.trim()),
  channel: z.enum(["kyc", "support"]).optional().default("support"),
});

export const gmailDraftSchema = z.object({
  to: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  body: z.string().optional().default(""),
  channel: z.enum(["kyc", "support"]).optional().default("support"),
});

export const threadParamsSchema = z.object({
  id: z.string().min(1),
});

export const draftParamsSchema = z.object({
  id: z.string().min(1),
});
