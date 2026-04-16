import { z } from "zod";

const channelEnum = z.enum(["intercom", "gmail", "luciq"]);
const idsArray = z.array(z.string().min(1)).min(1).max(100);

export const bulkArchiveSchema = z.object({
  channel: channelEnum,
  ids: idsArray,
});

export const bulkAssignSchema = z.object({
  channel: channelEnum,
  ids: idsArray,
  assigneeEmail: z.string().email(),
});

export const bulkTagSchema = z.object({
  channel: channelEnum,
  ids: idsArray,
  tagId: z.string().cuid("Invalid tag ID"),
});

export const bulkSnoozeSchema = z.object({
  channel: channelEnum,
  ids: idsArray,
  until: z.string().datetime({ message: "Must be a valid ISO 8601 datetime" }),
});
