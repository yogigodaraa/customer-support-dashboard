import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validate } from "../middleware/validate.js";
import { createTemplateSchema, updateTemplateSchema, templateParamsSchema, templateQuerySchema } from "../schemas/templates.js";
import logger from "../utils/logger.js";

const router = Router();
const prisma = new PrismaClient();

// Default WeMoney-style templates seeded on first load
const DEFAULT_TEMPLATES = [
  {
    title: "Insufficient Documents",
    category: "ID Verification",
    body: `Hi {{customer_name}},

Thanks for submitting your documents!

Upon further investigation, our team wasn't able to verify your account as no valid documents were uploaded.

To verify your account, please reply to this email with clear photos of:
• A government-issued photo ID (driver's licence or passport)
• The ID must be current and not expired

Once we receive the correct documents, we'll complete your verification within 1 business day.

If you have any questions, please don't hesitate to reach out.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
  {
    title: "Driver's License Failed",
    category: "ID Verification",
    body: `Hi {{customer_name}},

Thanks for submitting your documents!

Unfortunately, we were unable to verify your driver's licence. This can happen when:
• The image is blurry or partially cut off
• The licence has expired
• The name on the licence doesn't match your account

Could you please resend a clear, full photo of your current driver's licence?

We'll complete your verification as soon as we receive it.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
  {
    title: "Medicare Failed",
    category: "ID Verification",
    body: `Hi {{customer_name}},

Thanks for submitting your documents!

We were unable to verify your Medicare card. Please ensure:
• The card is clearly visible and not expired
• Your full name on the card matches your account name
• The card number and reference number are clearly readable

Please resend a clear photo of your Medicare card and we'll complete your verification promptly.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
  {
    title: "Account Successfully Verified",
    category: "ID Verification",
    body: `Hi {{customer_name}},

Great news — your identity has been successfully verified! 🎉

Your WeMoney account is now fully active. You can now access all features including:
• Credit score monitoring
• Personalised financial insights
• Partner offers and deals

If you have any questions, we're always here to help.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
  {
    title: "Referral Payment Inquiry",
    category: "Billing",
    body: `Hi {{customer_name}},

Thanks for reaching out about your referral payment.

Referral rewards are processed within 30 days after your referred friend completes their account verification. Here's a quick summary:

• Referral bonus: credited to your account once conditions are met
• Your referred friend must complete identity verification
• Rewards are subject to our referral program terms

If it's been more than 30 days and you haven't received your reward, please reply with your referred friend's email address and we'll investigate right away.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
  {
    title: "Subscription Cancellation",
    category: "Billing",
    body: `Hi {{customer_name}},

We're sorry to see you go!

Your WeMoney subscription has been cancelled as requested. You'll continue to have access to your current plan until {{end_date}}.

After that date:
• Your credit score monitoring will be paused
• Your account data will be retained for 12 months
• You can reactivate at any time

If there's anything we could have done better, we'd love to hear your feedback.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
  {
    title: "Welcome to WeMoney",
    category: "General",
    body: `Hi {{customer_name}},

Welcome to WeMoney! We're thrilled to have you on board. 🎉

Here's how to get the most out of your account:

1. Complete your identity verification to unlock all features
2. Connect your bank accounts for personalised insights
3. Check your free credit score in the app
4. Explore partner offers tailored to your financial profile

If you need any help getting started, just reply to this email — we're here for you.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
  {
    title: "Generic Follow-up",
    category: "General",
    body: `Hi {{customer_name}},

I just wanted to follow up on your recent inquiry to make sure everything has been resolved to your satisfaction.

If you're still experiencing any issues or have further questions, please don't hesitate to reply to this email and we'll be happy to assist.

Kind regards,
{{agent_name}}
WeMoney Member Success`,
  },
];

// Seed defaults if table is empty
async function seedIfEmpty() {
  try {
    const count = await prisma.template.count();
    if (count === 0) {
      await prisma.template.createMany({ data: DEFAULT_TEMPLATES });
      logger.info(`Seeded ${DEFAULT_TEMPLATES.length} default templates`);
    }
  } catch (err) {
    logger.warn("Could not seed templates:", err);
  }
}

seedIfEmpty();

// GET /api/templates — list with optional ?q= search and ?category= filter
router.get("/", validate({ query: templateQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { q, category } = req.query as { q?: string; category?: string };

    const templates = await prisma.template.findMany({
      where: {
        ...(category && category !== "All" ? { category } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    // Also return distinct categories for the filter pills
    const categories = await prisma.template.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    res.json({
      templates,
      categories: categories.map((c) => c.category),
    });
  } catch (error) {
    logger.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// POST /api/templates — create
router.post("/", validate({ body: createTemplateSchema }), async (req: Request, res: Response) => {
  try {
    const { title, body, category } = req.body;
    const template = await prisma.template.create({
      data: { title, body, category: category || "General" },
    });
    res.status(201).json(template);
  } catch (error) {
    logger.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// PUT /api/templates/:id — update
router.put("/:id", validate({ params: templateParamsSchema, body: updateTemplateSchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, body, category } = req.body;
    const template = await prisma.template.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(category !== undefined ? { category } : {}),
      },
    });
    res.json(template);
  } catch (error) {
    logger.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// DELETE /api/templates/:id
router.delete("/:id", validate({ params: templateParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.template.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
