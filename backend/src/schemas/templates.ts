import { z } from "zod";

export const createTemplateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Body is required"),
  category: z.string().optional().default("General"),
});

export const updateTemplateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  category: z.string().optional(),
});

export const templateQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
});

export const templateParamsSchema = z.object({
  id: z.string().min(1, "Template ID is required"),
});
