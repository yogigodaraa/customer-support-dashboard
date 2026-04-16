import { z } from "zod";

export const noteBodySchema = z.object({
  body: z.string().min(1, "Note body is required").max(10000),
});

export const noteParamsSchema = z.object({
  channel: z.enum(["intercom", "gmail", "luciq"]),
  externalId: z.string().min(1),
  noteId: z.string().cuid("Invalid note ID"),
});
