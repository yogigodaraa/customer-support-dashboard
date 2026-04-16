import { z } from "zod";

const ALLOWED_WORKSPACE_KEYS = [
  "business_hours_start",
  "business_hours_end",
  "business_hours_timezone",
  "brand_name",
  "brand_color",
  "support_email",
] as const;

export const workspaceSettingsSchema = z.record(
  z.enum(ALLOWED_WORKSPACE_KEYS),
  z.string()
);

export const notificationPrefSchema = z.object({
  emailOnAssign: z.boolean().optional(),
  emailOnMention: z.boolean().optional(),
  emailOnKycStatus: z.boolean().optional(),
  inAppOnAssign: z.boolean().optional(),
  inAppOnMention: z.boolean().optional(),
  inAppOnSlaWarning: z.boolean().optional(),
});

export const teamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366F1"),
});

export const teamMemberSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
  role: z.enum(["lead", "member"]).default("member"),
});

export const teamParamsSchema = z.object({
  id: z.string().cuid("Invalid team ID"),
});

export const teamMemberParamsSchema = z.object({
  id: z.string().cuid("Invalid team ID"),
  userId: z.string().cuid("Invalid user ID"),
});
