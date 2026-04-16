import { z } from "zod";

export const aiChatSchema = z.object({
  message: z.string().min(1, "message is required").transform((s) => s.trim()),
  conversationContext: z.any().optional(),
  history: z.array(z.any()).optional().default([]),
});
