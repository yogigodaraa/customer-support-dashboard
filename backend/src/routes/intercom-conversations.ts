import { Router, Request, Response } from "express";
import IntercomService, {
  IntercomConversation,
  IntercomConversationPart,
} from "../services/intercomService.js";
import logger from "../utils/logger.js";
import { emitToChannel } from "../websocket.js";
import { recordFirstResponse, recordResolution } from "../services/slaService.js";
import { validate } from "../middleware/validate.js";
import {
  replyBodySchema,
  stateUpdateBodySchema,
  assignBodySchema,
  noteBodySchema,
  conversationParamsSchema,
} from "../schemas/intercom.js";

const router = Router();
const intercom = new IntercomService(
  process.env.INTERCOM_ACCESS_TOKEN || ""
);

// ─── Mock data (used as fallback when no token is configured) ─────────────────

const now = Date.now();
const h = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString();
const d = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const MOCK_CONVERSATIONS = [
  {
    id: "ic_001",
    title: "Can't connect my bank account",
    state: "open",
    contact: { name: "Liam Chen", email: "liam.chen@gmail.com", avatar: "LC" },
    assignee: { name: "Chloe Koh" },
    channel: "in-app chat",
    created_at: h(2),
    last_message_at: h(1),
    last_message_preview:
      "I've tried 3 times but my Westpac account won't connect.",
    messages: [
      {
        id: "ic_msg_001_1",
        from: { name: "Liam Chen", type: "user" },
        body: "Hi! I've been trying to connect my Westpac account but it keeps failing. The error says 'Connection timeout'. I've tried 3 times now.",
        created_at: h(2),
        is_inbound: true,
      },
      {
        id: "ic_msg_001_2",
        from: { name: "Chloe Koh", type: "agent" },
        body: "Hi Liam! Thanks for reaching out 😊\n\nSorry to hear you're having trouble connecting your Westpac account. Could you let me know:\n1. Which device and OS are you using?\n2. Are you seeing any specific error code?\n\nI'll get this sorted for you right away!",
        created_at: h(1.5),
        is_inbound: false,
      },
      {
        id: "ic_msg_001_3",
        from: { name: "Liam Chen", type: "user" },
        body: "I've tried 3 times but my Westpac account won't connect. Using iPhone 15, iOS 17.3. The error just says 'Connection timeout'.",
        created_at: h(1),
        is_inbound: true,
      },
    ],
  },
  {
    id: "ic_002",
    title: "How do I improve my credit score?",
    state: "open",
    contact: {
      name: "Priya Sharma",
      email: "priya.sharma@outlook.com",
      avatar: "PS",
    },
    assignee: null,
    channel: "in-app chat",
    created_at: h(5),
    last_message_at: h(4),
    last_message_preview: "I have a score of 580 and want to get it above 700.",
    messages: [
      {
        id: "ic_msg_002_1",
        from: { name: "Priya Sharma", type: "user" },
        body: "Hi, I have a score of 580 and want to get it above 700. What's the best way to do this?",
        created_at: h(5),
        is_inbound: true,
      },
      {
        id: "ic_msg_002_2",
        from: { name: "WeMoney Bot", type: "bot" },
        body: "Hi there! 👋 Great question about improving your credit score. Here are some quick tips:\n\n• Pay bills on time (biggest factor!)\n• Reduce your credit card balances\n• Don't apply for multiple credits at once\n• Keep old credit accounts open\n\nA human agent will follow up with personalised advice shortly!",
        created_at: h(4.9),
        is_inbound: false,
      },
      {
        id: "ic_msg_002_3",
        from: { name: "Priya Sharma", type: "user" },
        body: "I have a score of 580 and want to get it above 700. My main issue is I had a late payment 2 years ago.",
        created_at: h(4),
        is_inbound: true,
      },
    ],
  },
  {
    id: "ic_003",
    title: "Subscription upgrade question",
    state: "open",
    contact: {
      name: "Jake Morrison",
      email: "jake.morrison@yahoo.com",
      avatar: "JM",
    },
    assignee: { name: "Yogender" },
    channel: "in-app chat",
    created_at: h(8),
    last_message_at: h(7),
    last_message_preview:
      "What's included in the Premium plan vs the free plan?",
    messages: [
      {
        id: "ic_msg_003_1",
        from: { name: "Jake Morrison", type: "user" },
        body: "What's included in the Premium plan vs the free plan? I'm thinking of upgrading.",
        created_at: h(8),
        is_inbound: true,
      },
      {
        id: "ic_msg_003_2",
        from: { name: "Yogender", type: "agent" },
        body: "Hi Jake! Great timing — we have a promotion running this week. 🎉\n\nPremium includes:\n✅ Daily credit score updates (free = monthly)\n✅ Credit report deep dive\n✅ Dispute assistance\n✅ Priority support\n✅ Advanced financial insights\n\nWould you like me to upgrade your account now?",
        created_at: h(7.5),
        is_inbound: false,
      },
      {
        id: "ic_msg_003_3",
        from: { name: "Jake Morrison", type: "user" },
        body: "What's the price? And can I cancel anytime?",
        created_at: h(7),
        is_inbound: true,
      },
    ],
  },
  {
    id: "ic_004",
    title: "Wrong credit score displayed",
    state: "open",
    contact: {
      name: "Aisha Patel",
      email: "aisha.patel@gmail.com",
      avatar: "AP",
    },
    assignee: { name: "Chloe Koh" },
    channel: "in-app chat",
    created_at: d(1),
    last_message_at: h(20),
    last_message_preview:
      "My score dropped 80 points overnight but nothing changed in my finances.",
    messages: [
      {
        id: "ic_msg_004_1",
        from: { name: "Aisha Patel", type: "user" },
        body: "My score dropped 80 points overnight but nothing changed in my finances. This doesn't make sense.",
        created_at: d(1),
        is_inbound: true,
      },
      {
        id: "ic_msg_004_2",
        from: { name: "Chloe Koh", type: "agent" },
        body: "Hi Aisha, I'm so sorry to hear about this sudden drop — that must be concerning! 😟\n\nA sudden score change can happen for a few reasons:\n• A new credit enquiry (even ones you didn't initiate)\n• A change in credit limit\n• A late payment recorded by a lender\n\nI'm going to check your credit report now. Could you let me know if you've applied for any credit recently?",
        created_at: h(22),
        is_inbound: false,
      },
      {
        id: "ic_msg_004_3",
        from: { name: "Aisha Patel", type: "user" },
        body: "No I haven't applied for anything. Score dropped from 720 to 640 overnight. Something must be wrong.",
        created_at: h(20),
        is_inbound: true,
      },
    ],
  },
  {
    id: "ic_005",
    title: "Account deletion request",
    state: "open",
    contact: {
      name: "Tom Nguyen",
      email: "tom.nguyen@hotmail.com",
      avatar: "TN",
    },
    assignee: null,
    channel: "in-app chat",
    created_at: h(12),
    last_message_at: h(11),
    last_message_preview:
      "I'd like to delete my account and have all my data removed.",
    messages: [
      {
        id: "ic_msg_005_1",
        from: { name: "Tom Nguyen", type: "user" },
        body: "I'd like to delete my account and have all my data removed. How do I do this?",
        created_at: h(12),
        is_inbound: true,
      },
      {
        id: "ic_msg_005_2",
        from: { name: "WeMoney Bot", type: "bot" },
        body: "Hi! We're sorry to see you go 😢\n\nTo delete your account, you can:\n1. Go to Settings → Account → Delete Account in the app\n\nOr let us know here and an agent will process your request.\n\nPlease note: This action is irreversible and your data will be removed within 30 days per our privacy policy.",
        created_at: h(11.9),
        is_inbound: false,
      },
      {
        id: "ic_msg_005_3",
        from: { name: "Tom Nguyen", type: "user" },
        body: "I'd like to delete my account and have all my data removed. Please process this via the agent.",
        created_at: h(11),
        is_inbound: true,
      },
    ],
  },
  {
    id: "ic_006",
    title: "Referral link not working",
    state: "closed",
    contact: {
      name: "Sarah Lin",
      email: "sarah.lin@gmail.com",
      avatar: "SL",
    },
    assignee: { name: "Yogender" },
    channel: "in-app chat",
    created_at: d(3),
    last_message_at: d(2),
    last_message_preview: "The referral link is working now, thanks!",
    messages: [
      {
        id: "ic_msg_006_1",
        from: { name: "Sarah Lin", type: "user" },
        body: "My referral link isn't working. When I share it with friends they get an error page.",
        created_at: d(3),
        is_inbound: true,
      },
      {
        id: "ic_msg_006_2",
        from: { name: "Yogender", type: "agent" },
        body: "Hi Sarah! I can see the issue — your referral link had an encoding problem. I've generated a fresh link for you. Please try sharing this one: wemoney.com.au/ref/SARAH2025\n\nLet me know if this works! 🙌",
        created_at: d(2),
        is_inbound: false,
      },
      {
        id: "ic_msg_006_3",
        from: { name: "Sarah Lin", type: "user" },
        body: "The referral link is working now, thanks!",
        created_at: d(2),
        is_inbound: true,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/** Map a real Intercom conversation object to the format the frontend expects. */
function mapRealConversation(conv: IntercomConversation) {
  const contact = conv.contacts?.contacts?.[0];
  const parts = conv.conversation_parts?.conversation_parts ?? [];

  // Find the last visible comment for the preview
  const lastCommentPart = [...parts]
    .reverse()
    .find((p) => p.part_type === "comment" && p.body);

  const lastMessageBody =
    lastCommentPart?.body ?? conv.source?.body ?? "";
  const lastMessageAt = new Date(conv.updated_at * 1000).toISOString();

  return {
    id: conv.id,
    title:
      conv.source?.subject ||
      conv.title ||
      `Conversation ${conv.id}`,
    state: conv.state,
    contact: {
      name:
        contact?.name ||
        contact?.email ||
        conv.source?.author?.name ||
        "Unknown",
      email: contact?.email || conv.source?.author?.email || "",
      avatar: (
        contact?.name ||
        contact?.email ||
        "?"
      )
        .slice(0, 2)
        .toUpperCase(),
    },
    assignee: conv.assignee?.name
      ? { name: conv.assignee.name }
      : null,
    channel: conv.source?.type || "unknown",
    created_at: new Date(conv.created_at * 1000).toISOString(),
    last_message_at: lastMessageAt,
    last_message_preview: lastMessageBody.replace(/<[^>]+>/g, "").slice(0, 120),
    time_ago: timeAgo(lastMessageAt),
  };
}

/** Map a real Intercom conversation part to the message format the frontend expects. */
function mapRealMessage(part: IntercomConversationPart) {
  return {
    id: part.id,
    from: {
      name: part.author.name || "Unknown",
      type:
        part.author.type === "bot"
          ? "bot"
          : part.author.type === "admin"
          ? "agent"
          : "user",
    },
    body: (part.body || "").replace(/<[^>]+>/g, ""),
    created_at: new Date(part.created_at * 1000).toISOString(),
    is_inbound: part.author.type === "user",
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/intercom/conversations
router.get("/conversations", async (req: Request, res: Response) => {
  // ── Try real Intercom API first ──
  if (intercom.hasToken) {
    try {
      const { state, page, per_page } = req.query as Record<string, string>;
      const result = await intercom.listConversations({
        state: (state as "open" | "closed" | "all") || "open",
        page: page ? parseInt(page, 10) : 1,
        perPage: per_page ? parseInt(per_page, 10) : 20,
      });

      const conversations = result.conversations.map(mapRealConversation);
      const open = result.conversations.filter((c) => c.state === "open").length;
      const closed = result.conversations.filter(
        (c) => c.state === "closed"
      ).length;

      return res.json({
        conversations,
        total: result.total_count,
        pages: result.pages,
        counts: {
          all: result.total_count,
          open,
          closed,
        },
      });
    } catch (err) {
      logger.warn("Real Intercom conversations API failed, using mock:", err);
    }
  }

  // ── Mock fallback ──
  const { state, q } = req.query as Record<string, string>;
  let list = [...MOCK_CONVERSATIONS];
  if (state && state !== "all") list = list.filter((c) => c.state === state);
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(lq) ||
        c.contact.name.toLowerCase().includes(lq) ||
        c.last_message_preview.toLowerCase().includes(lq)
    );
  }
  list.sort(
    (a, b) =>
      new Date(b.last_message_at).getTime() -
      new Date(a.last_message_at).getTime()
  );

  res.json({
    conversations: list.map(({ messages: _m, ...c }) => ({
      ...c,
      time_ago: timeAgo(c.last_message_at),
    })),
    total: list.length,
    counts: {
      all: MOCK_CONVERSATIONS.length,
      open: MOCK_CONVERSATIONS.filter((c) => c.state === "open").length,
      closed: MOCK_CONVERSATIONS.filter((c) => c.state === "closed").length,
    },
  });
});

// GET /api/intercom/conversations/:id
router.get("/conversations/:id", async (req: Request, res: Response) => {
  if (intercom.hasToken) {
    try {
      const conv = await intercom.getConversation(req.params.id);
      if (!conv) return res.status(404).json({ error: "Conversation not found" });

      const parts = conv.conversation_parts?.conversation_parts ?? [];
      // Include the initial source message as the first message
      const messages = [
        ...(conv.source?.body
          ? [
              {
                id: `source_${conv.id}`,
                from: {
                  name:
                    conv.source.author?.name ||
                    conv.contacts?.contacts?.[0]?.name ||
                    "User",
                  type: "user" as const,
                },
                body: conv.source.body.replace(/<[^>]+>/g, ""),
                created_at: new Date(conv.created_at * 1000).toISOString(),
                is_inbound: true,
              },
            ]
          : []),
        ...parts
          .filter((p) => p.part_type === "comment" || p.part_type === "note")
          .map(mapRealMessage),
      ];

      return res.json({
        ...mapRealConversation(conv),
        messages,
        time_ago: timeAgo(
          new Date(conv.updated_at * 1000).toISOString()
        ),
      });
    } catch (err) {
      logger.warn("Real Intercom getConversation failed, using mock:", err);
    }
  }

  const conv = MOCK_CONVERSATIONS.find((c) => c.id === req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  res.json({ ...conv, time_ago: timeAgo(conv.last_message_at) });
});

// POST /api/intercom/conversations/:id/reply
router.post(
  "/conversations/:id/reply",
  validate({ params: conversationParamsSchema, body: replyBodySchema }),
  async (req: Request, res: Response) => {
    const { body, admin_id } = req.body;

    if (!intercom.hasToken) {
      return res
        .status(503)
        .json({ error: "Intercom is not configured — set INTERCOM_ACCESS_TOKEN" });
    }

    try {
      const updated = await intercom.replyToConversation(
        req.params.id,
        body,
        admin_id
      );
      emitToChannel("intercom", "conversation:updated", { conversationId: req.params.id, action: "reply" });
      // SLA: record first response time (fire-and-forget)
      recordFirstResponse("intercom", req.params.id, new Date(Date.now() - 60000)).catch(() => {});
      res.json(updated);
    } catch (error) {
      logger.error("Reply to conversation failed:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  }
);

// PUT /api/intercom/conversations/:id/state
router.put(
  "/conversations/:id/state",
  validate({ params: conversationParamsSchema, body: stateUpdateBodySchema }),
  async (req: Request, res: Response) => {
    const { state, admin_id, snooze_until } = req.body;

    if (!intercom.hasToken) {
      return res
        .status(503)
        .json({ error: "Intercom is not configured — set INTERCOM_ACCESS_TOKEN" });
    }

    try {
      const updated = await intercom.updateConversationState(
        req.params.id,
        state,
        admin_id,
        snooze_until
      );
      emitToChannel("intercom", "conversation:updated", { conversationId: req.params.id, action: "state_change", state });
      // SLA: record resolution when closing
      if (state === "closed") {
        recordResolution("intercom", req.params.id, new Date(Date.now() - 3600000)).catch(() => {});
      }
      res.json(updated);
    } catch (error) {
      logger.error("Update conversation state failed:", error);
      res.status(500).json({ error: "Failed to update conversation state" });
    }
  }
);

// PUT /api/intercom/conversations/:id/assign
router.put(
  "/conversations/:id/assign",
  validate({ params: conversationParamsSchema, body: assignBodySchema }),
  async (req: Request, res: Response) => {
    const { admin_id, assignee_id } = req.body;

    if (!intercom.hasToken) {
      return res
        .status(503)
        .json({ error: "Intercom is not configured — set INTERCOM_ACCESS_TOKEN" });
    }

    try {
      const updated = await intercom.assignConversation(
        req.params.id,
        admin_id,
        assignee_id
      );
      emitToChannel("intercom", "assignment:changed", { conversationId: req.params.id, assigneeId: assignee_id });
      res.json(updated);
    } catch (error) {
      logger.error("Assign conversation failed:", error);
      res.status(500).json({ error: "Failed to assign conversation" });
    }
  }
);

// GET /api/intercom/contacts/:id/conversations
router.get(
  "/contacts/:id/conversations",
  async (req: Request, res: Response) => {
    if (!intercom.hasToken) {
      return res
        .status(503)
        .json({ error: "Intercom is not configured — set INTERCOM_ACCESS_TOKEN" });
    }
    try {
      const conversations = await intercom.getContactConversations(
        req.params.id
      );
      res.json({
        conversations: conversations.map(mapRealConversation),
        total: conversations.length,
      });
    } catch (error) {
      logger.error("Get contact conversations failed:", error);
      res.status(500).json({ error: "Failed to fetch contact conversations" });
    }
  }
);

// GET /api/intercom/contacts/:id/notes
router.get("/contacts/:id/notes", async (req: Request, res: Response) => {
  if (!intercom.hasToken) {
    return res
      .status(503)
      .json({ error: "Intercom is not configured — set INTERCOM_ACCESS_TOKEN" });
  }
  try {
    const notes = await intercom.getContactNotes(req.params.id);
    res.json({ notes, total: notes.length });
  } catch (error) {
    logger.error("Get contact notes failed:", error);
    res.status(500).json({ error: "Failed to fetch contact notes" });
  }
});

// POST /api/intercom/contacts/:id/notes
router.post(
  "/contacts/:id/notes",
  validate({ params: conversationParamsSchema, body: noteBodySchema }),
  async (req: Request, res: Response) => {
    const { body, admin_id } = req.body;

    if (!intercom.hasToken) {
      return res
        .status(503)
        .json({ error: "Intercom is not configured — set INTERCOM_ACCESS_TOKEN" });
    }

    try {
      const note = await intercom.createNote(req.params.id, body, admin_id);
      res.status(201).json(note);
    } catch (error) {
      logger.error("Create note failed:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  }
);

export default router;
