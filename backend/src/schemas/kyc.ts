import { z } from "zod";

export const REJECTION_REASONS = [
  "Blurry image",
  "Expired document",
  "Name mismatch",
  "Incomplete document",
  "Wrong document type",
  "Photocopy not accepted",
  "Document not in English",
  "Address not matching",
  "Face not visible",
  "Suspicious document",
] as const;

export const DOC_TYPES = [
  "passport",
  "drivers_license",
  "utility_bill",
  "bank_statement",
  "selfie",
  "other",
] as const;

export const KYC_STATUSES = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "escalated",
] as const;

export const RISK_LEVELS = ["low", "medium", "high"] as const;

// ─── Params ────────────────────────────────────────────────────────────────

export const caseParamsSchema = z.object({
  id: z.string().cuid("Invalid case ID"),
});

export const docParamsSchema = z.object({
  id: z.string().cuid("Invalid case ID"),
  docId: z.string().cuid("Invalid document ID"),
});

// ─── Case CRUD ─────────────────────────────────────────────────────────────

export const createCaseSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  customerId: z.string().optional(),
  riskLevel: z.enum(RISK_LEVELS).default("medium"),
  isPriority: z.boolean().default(false),
  gmailThreadId: z.string().optional(),
});

export const listCasesSchema = z.object({
  status: z.enum([...KYC_STATUSES, "all"]).optional().default("all"),
  riskLevel: z.enum([...RISK_LEVELS, "all"]).optional().default("all"),
  assigneeId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Status transition ─────────────────────────────────────────────────────

export const updateStatusSchema = z
  .object({
    status: z.enum(KYC_STATUSES),
    rejectionReason: z.string().min(1).optional(),
  })
  .refine(
    (d) => d.status !== "rejected" || !!d.rejectionReason,
    {
      message: "A rejection reason is required when rejecting",
      path: ["rejectionReason"],
    }
  );

// ─── Assignment ────────────────────────────────────────────────────────────

export const assignSchema = z.object({
  assigneeId: z.string().cuid("Invalid user ID").nullable(),
});

// ─── Checklist ────────────────────────────────────────────────────────────

export const checklistSchema = z.object({
  id_verified: z.boolean().nullable().optional(),
  address_verified: z.boolean().nullable().optional(),
  face_match: z.boolean().nullable().optional(),
});

// ─── Documents ────────────────────────────────────────────────────────────

export const docTypeSchema = z.object({
  type: z.enum(DOC_TYPES),
});

export const docReviewSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  reviewNote: z.string().max(500).optional(),
});

// ─── Bulk ─────────────────────────────────────────────────────────────────

export const bulkStatusSchema = z
  .object({
    ids: z.array(z.string().cuid()).min(1).max(50),
    status: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().min(1).optional(),
  })
  .refine(
    (d) => d.status !== "rejected" || !!d.rejectionReason,
    {
      message: "A rejection reason is required for bulk rejection",
      path: ["rejectionReason"],
    }
  );
