import { z } from "zod";

export const changeRoleSchema = z.object({
  role: z.enum(["admin", "agent", "viewer"]),
});

export const userParamsSchema = z.object({
  id: z.string().min(1),
});

export const serviceParamsSchema = z.object({
  service: z.enum(["intercom", "gmail", "luciq", "retool"]),
});

export const updateIntegrationSchema = z.object({
  key: z.string().min(1, "API key is required").transform((s) => s.trim()),
  label: z.string().optional(),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  action: z.string().optional(),
  userId: z.string().optional(),
});
