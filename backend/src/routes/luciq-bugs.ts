import { Router, Request, Response } from "express";
import logger from "../utils/logger.js";
import { emitToChannel } from "../websocket.js";
import { validate } from "../middleware/validate.js";
import {
  bugPatchSchema,
  bugCommentSchema,
  bugParamsSchema,
} from "../schemas/luciq.js";

const router = Router();

const now = Date.now();
const h = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString();
const d = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

// Mutable so PATCH can update in memory
let MOCK_BUGS: typeof INITIAL_BUGS = [];

const INITIAL_BUGS = [
  {
    id: "bug_001",
    title: "Two-factor authentication loop on login",
    description: "Multiple users are reporting that after entering their 2FA code they are redirected back to the login screen instead of being authenticated. This affects both SMS and authenticator app 2FA methods.\n\nSteps to reproduce:\n1. Enter email and password\n2. Enter 2FA code\n3. Page redirects back to login instead of dashboard\n\nAffected users: ~12 reported so far\nEnvironment: iOS and Android apps, web browser",
    status: "open",
    priority: "critical",
    reporter: { name: "Elisabeth Edgar", email: "e.edgar@outlook.com" },
    assignee: null,
    tags: ["Authentication", "Security"],
    created_at: h(3),
    updated_at: h(3),
    comments: [
      {
        id: "c_001_1",
        from: { name: "Elisabeth Edgar", email: "e.edgar@outlook.com" },
        body: "This is still happening. I've been locked out for 3 hours.",
        created_at: h(2),
        is_internal: false,
      },
    ],
  },
  {
    id: "bug_002",
    title: "Credit score not updating — stuck on old value",
    description: "User's credit score has not refreshed despite the monthly update being due. The score displayed is from 2 months ago. The refresh button in the app does nothing.\n\nExpected: Score updates monthly automatically\nActual: Score shows value from December 2025\n\nUser confirmed their account is verified and connected.",
    status: "in_progress",
    priority: "critical",
    reporter: { name: "Isabelle de Villecourt", email: "isabelle.dev@gmail.com" },
    assignee: { name: "Engineering Team" },
    tags: ["Credit Score", "Equifax"],
    created_at: d(5),
    updated_at: h(6),
    comments: [
      {
        id: "c_002_1",
        from: { name: "Yogender", email: "kyc@wemoney.com.au" },
        body: "Confirmed with Equifax — there was a delay in their API. Fix being deployed.",
        created_at: h(6),
        is_internal: true,
      },
    ],
  },
  {
    id: "bug_003",
    title: "ANZ bank connection failing with error 503",
    description: "Users attempting to connect their ANZ bank account are receiving a 503 Service Unavailable error from Basiq. The connection times out after 30 seconds.\n\nImpact: Unable to view ANZ transaction data or credit utilisation\nAffected: All ANZ customers (estimated 800+ users)\n\nBasiq status page shows no incidents — issue appears to be on our integration layer.",
    status: "in_progress",
    priority: "critical",
    reporter: { name: "Chris Kinlyside", email: "chris.kinlyside@icloud.com" },
    assignee: { name: "Engineering Team" },
    tags: ["Bank Connection", "Basiq", "ANZ"],
    created_at: d(2),
    updated_at: h(4),
    comments: [
      {
        id: "c_003_1",
        from: { name: "Chloe Koh", email: "hello@wemoney.com.au" },
        body: "Escalated to Basiq support. They confirmed a configuration issue on our end. Working on fix.",
        created_at: h(4),
        is_internal: true,
      },
    ],
  },
  {
    id: "bug_004",
    title: "Referral bonus not credited after 30 days",
    description: "User referred a friend who completed verification 35 days ago. The referral bonus has not been credited to either account.\n\nReferrer: Tra Bak (trabak@gmail.com)\nReferred: trabak_friend@gmail.com\nVerification completed: 35 days ago\n\nReferral system shows 'Pending' status — should be 'Completed'.",
    status: "open",
    priority: "high",
    reporter: { name: "Tra Bak", email: "trabak@gmail.com" },
    assignee: null,
    tags: ["Referral", "Billing"],
    created_at: d(3),
    updated_at: d(3),
    comments: [],
  },
  {
    id: "bug_005",
    title: "App crashes on iOS 17.4 when opening Insights tab",
    description: "The WeMoney iOS app crashes immediately when navigating to the Insights tab. This was introduced in the latest app update (v3.2.1).\n\nDevice: iPhone 15 Pro, iOS 17.4\nApp version: 3.2.1\nCrash log: EXC_BAD_ACCESS (SIGSEGV)\n\nWorkaround: Uninstall and reinstall previous version (3.2.0) — but this is not ideal for users.",
    status: "in_progress",
    priority: "high",
    reporter: { name: "Robin Trotman", email: "sherrybobbin@hotmail.com" },
    assignee: { name: "Mobile Team" },
    tags: ["iOS", "Crash", "Insights"],
    created_at: d(7),
    updated_at: d(1),
    comments: [
      {
        id: "c_005_1",
        from: { name: "Engineering Team", email: "engineering@wemoney.com.au" },
        body: "Identified the issue — a null pointer in the chart rendering library. Patch targeted for next release.",
        created_at: d(1),
        is_internal: true,
      },
    ],
  },
  {
    id: "bug_006",
    title: "Push notifications not delivered on Android",
    description: "Android users are not receiving push notifications for credit score updates and new partner offers. The notifications show as 'sent' in Firebase but are not appearing on devices.\n\nAffected: Android 13+ users\nNot affected: iOS users\n\nFirebase Cloud Messaging token appears to expire without renewal.",
    status: "open",
    priority: "medium",
    reporter: { name: "Muheet Khan", email: "muheet.khan@hotmail.com" },
    assignee: null,
    tags: ["Android", "Notifications", "Firebase"],
    created_at: d(4),
    updated_at: d(4),
    comments: [],
  },
  {
    id: "bug_007",
    title: "Amex card disappearing from connected accounts",
    description: "American Express cards are being disconnected from the accounts list within 24 hours of being connected. The user has to reconnect the card repeatedly.\n\nThis appears to be a token refresh issue with the Amex open banking API. The connection token is not being renewed automatically.\n\nAffected users: Multiple reports (at least 8 in the past week)",
    status: "in_progress",
    priority: "high",
    reporter: { name: "Elisabeth Edgar", email: "e.edgar@outlook.com" },
    assignee: { name: "Engineering Team" },
    tags: ["Bank Connection", "Amex", "Open Banking"],
    created_at: d(10),
    updated_at: h(14),
    comments: [
      {
        id: "c_007_1",
        from: { name: "Engineering Team", email: "engineering@wemoney.com.au" },
        body: "Root cause identified: Amex API returns a non-standard token expiry format. Fix in review.",
        created_at: h(14),
        is_internal: true,
      },
    ],
  },
  {
    id: "bug_008",
    title: "Marketing unsubscribe not working for partner emails",
    description: "Users who have unsubscribed from marketing emails are still receiving partner offer emails. The unsubscribe link works for WeMoney newsletters but does not suppress partner offer campaigns.\n\nThe two email lists appear to be managed separately and the suppression list is not syncing between them.",
    status: "open",
    priority: "medium",
    reporter: { name: "Chris Kinlyside", email: "chris.kinlyside@icloud.com" },
    assignee: null,
    tags: ["Marketing", "Email", "Compliance"],
    created_at: d(1),
    updated_at: d(1),
    comments: [],
  },
];

// Initialise mutable copy from seed data
MOCK_BUGS = INITIAL_BUGS.map(b => ({ ...b, comments: [...b.comments] }));

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// GET /api/luciq/bugs
router.get("/bugs", async (req: Request, res: Response) => {
  try {
    const { status, priority, q } = req.query as Record<string, string>;

    let list = [...MOCK_BUGS];

    if (status && status !== "all") list = list.filter((b) => b.status === status);
    if (priority) list = list.filter((b) => b.priority === priority);
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(lq) ||
          b.description.toLowerCase().includes(lq) ||
          b.reporter.name.toLowerCase().includes(lq) ||
          b.tags.some((t) => t.toLowerCase().includes(lq))
      );
    }

    list.sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
        PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER]
    );

    res.json({
      bugs: list.map(({ comments: _c, ...b }) => ({
        ...b,
        time_ago: timeAgo(b.updated_at),
      })),
      total: list.length,
      counts: {
        all: MOCK_BUGS.length,
        open: MOCK_BUGS.filter((b) => b.status === "open").length,
        in_progress: MOCK_BUGS.filter((b) => b.status === "in_progress").length,
        closed: MOCK_BUGS.filter((b) => b.status === "closed").length,
        critical: MOCK_BUGS.filter((b) => b.priority === "critical").length,
      },
    });
  } catch (error) {
    logger.error("Error fetching Luciq bugs:", error);
    res.status(500).json({ error: "Failed to fetch bugs" });
  }
});

// GET /api/luciq/bugs/:id
router.get("/bugs/:id", async (req: Request, res: Response) => {
  try {
    const bug = MOCK_BUGS.find((b) => b.id === req.params.id);
    if (!bug) return res.status(404).json({ error: "Bug not found" });
    res.json({ ...bug, time_ago: timeAgo(bug.updated_at) });
  } catch (error) {
    logger.error("Error fetching bug:", error);
    res.status(500).json({ error: "Failed to fetch bug" });
  }
});

// PATCH /api/luciq/bugs/:id  — update status and/or priority
router.patch(
  "/bugs/:id",
  validate({ params: bugParamsSchema, body: bugPatchSchema }),
  async (req: Request, res: Response) => {
    try {
      const idx = MOCK_BUGS.findIndex((b) => b.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Bug not found" });

      const { status, priority, assignee_email } = req.body;

      const bug = MOCK_BUGS[idx];
      if (status)         bug.status   = status;
      if (priority)       bug.priority = priority;
      if (assignee_email) bug.assignee = { name: assignee_email };
      bug.updated_at = new Date().toISOString();

      logger.info(`Luciq bug ${bug.id} updated: ${JSON.stringify({ status, priority, assignee_email })}`);
      emitToChannel("luciq", "bug:updated", { bugId: bug.id, status, priority, assignee_email });
      res.json({ ...bug, time_ago: timeAgo(bug.updated_at) });
    } catch (error) {
      logger.error("Error updating bug:", error);
      res.status(500).json({ error: "Failed to update bug" });
    }
  }
);

// POST /api/luciq/bugs/:id/comments  — add a comment or internal note
router.post(
  "/bugs/:id/comments",
  validate({ params: bugParamsSchema, body: bugCommentSchema }),
  async (req: Request, res: Response) => {
    try {
      const bug = MOCK_BUGS.find((b) => b.id === req.params.id);
      if (!bug) return res.status(404).json({ error: "Bug not found" });

      const { body, author_name, author_email, is_internal } = req.body;

      const comment = {
        id: `c_${bug.id}_${Date.now()}`,
        from: {
          name:  author_name,
          email: author_email,
        },
        body,
        created_at:  new Date().toISOString(),
        is_internal,
      };

      bug.comments.push(comment);
      bug.updated_at = new Date().toISOString();

      logger.info(`Comment added to Luciq bug ${bug.id}`);
      emitToChannel("luciq", "bug:commented", { bugId: bug.id, commentId: comment.id });
      res.status(201).json(comment);
    } catch (error) {
      logger.error("Error adding comment:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  }
);

export default router;
