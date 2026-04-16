import { z } from "zod";

export const updateSettingsSchema = z.object({
  name: z.string().optional(),
  signature: z.string().optional(),
  signatureHtml: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  image: z.string().optional(),           // base64 data URL or external URL
  timezone: z.string().optional(),
  locale: z.string().optional(),
  oooEnabled: z.boolean().optional(),
  oooMessage: z.string().max(500).optional(),
  oooUntil: z.string().datetime().optional().nullable(),
  soundNotifications: z.boolean().optional(),
  desktopNotifications: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});
