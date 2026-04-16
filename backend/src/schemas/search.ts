import { z } from "zod";

export const searchBodySchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().min(1).max(256).optional(),
    source: z.string().optional(),
  })
  .refine((data) => data.email || data.userId, {
    message: "Either email or userId must be provided",
  });

export const cachedQuerySchema = z.object({
  identifier: z.string().min(1).max(256, "identifier too long"),
});
