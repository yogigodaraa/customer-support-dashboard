import { z } from "zod";

export const channelParamSchema = z.object({
  channel: z.enum(["intercom", "gmail", "luciq"]),
  externalId: z.string().min(1),
});

export const snoozeBodySchema = z.object({
  until: z.string().datetime({ message: "Must be a valid ISO 8601 datetime" }),
});

export const tagBodySchema = z.object({
  tagId: z.string().cuid("Invalid tag ID"),
});
