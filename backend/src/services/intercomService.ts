import axios, { AxiosInstance } from "axios";
import logger from "../utils/logger.js";

// ─── Contact types ────────────────────────────────────────────────────────────

export interface IntercomContact {
  id: string;
  external_id?: string;
  type?: string;
  email?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  created_at?: number;
  updated_at?: number;
  last_seen_at?: number;
  last_replied_at?: number;
  last_contacted_at?: number;
  last_request_at?: number;
  signed_up_at?: number;
  browser?: string;
  browser_version?: string;
  browser_language?: string;
  os?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  custom_attributes?: Record<string, unknown>;
  tags?: { tags: Array<{ id: string; name: string }> };
  notes?: { notes: unknown[] };
  companies?: { companies: unknown[] };
  conversation_count?: number;
  unsubscribed_from_emails?: boolean;
  marked_email_as_spam?: boolean;
  has_hard_bounced?: boolean;
}

// Legacy alias kept for backward compatibility
export type IntercomUser = Pick<IntercomContact, "id" | "email" | "name">;

// ─── Conversation / Part types ────────────────────────────────────────────────

export interface IntercomConversationPart {
  id: string;
  part_type:
    | "comment"
    | "note"
    | "assignment"
    | "snoozed"
    | "unsnoozed"
    | "closed"
    | "reopened";
  body?: string;
  created_at: number;
  updated_at?: number;
  author: {
    id: string;
    type: "user" | "admin" | "bot";
    name?: string;
    email?: string;
  };
  attachments?: unknown[];
}

export interface IntercomConversation {
  id: string;
  title?: string;
  state: "open" | "closed" | "snoozed";
  read: boolean;
  created_at: number;
  updated_at: number;
  waiting_since?: number;
  snoozed_until?: number;
  source: {
    type: string;
    id?: string;
    delivered_as?: string;
    subject?: string;
    body?: string;
    author?: {
      id: string;
      type: string;
      name?: string;
      email?: string;
    };
    url?: string;
  };
  contacts: {
    type: string;
    contacts: Array<{
      id: string;
      type: string;
      external_id?: string;
      email?: string;
      name?: string;
    }>;
  };
  teammates?: { teammates: Array<{ id: string; type: string }> };
  assignee?: {
    type: string;
    id?: string;
    name?: string;
    email?: string;
  };
  team_assignee?: { type: string; id?: string; name?: string };
  tags?: { tags: Array<{ id: string; name: string }> };
  first_contact_reply?: { created_at: number; type: string; url?: string };
  priority: "priority" | "not_priority";
  conversation_parts?: {
    type: string;
    conversation_parts: IntercomConversationPart[];
    total_count: number;
  };
  statistics?: {
    time_to_assignment?: number;
    time_to_admin_reply?: number;
    time_to_first_close?: number;
    time_to_last_close?: number;
    median_time_to_reply?: number;
    first_contact_reply_at?: number;
    first_assignment_at?: number;
    first_admin_reply_at?: number;
    first_close_at?: number;
    last_assignment_at?: number;
    last_assignment_admin_reply_at?: number;
    last_contact_reply_at?: number;
    last_admin_reply_at?: number;
    last_close_at?: number;
    last_closed_by_id?: string;
    count_reopens?: number;
    count_assignments?: number;
    count_conversation_parts?: number;
  };
}

export interface IntercomPaginatedConversations {
  conversations: IntercomConversation[];
  total_count: number;
  pages: {
    page: number;
    per_page: number;
    total_pages: number;
    next?: string;
  };
}

export interface IntercomConversationStats {
  open: number;
  newLast7Days: number;
  repliedLast7Days: number;
}

// ─── Retry config ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// ─── Service ──────────────────────────────────────────────────────────────────

class IntercomService {
  private client: AxiosInstance;
  /** True when an access token is configured — callers can gate on this flag */
  readonly hasToken: boolean;

  constructor(accessToken: string) {
    this.hasToken = Boolean(accessToken);

    this.client = axios.create({
      baseURL: "https://api.intercom.io",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Intercom-Version": "2.8",
      },
    });

    // Retry interceptor: handles 429 rate-limits and transient 5xx errors
    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        const config = error.config as Record<string, unknown> & {
          _retryCount?: number;
        };
        config._retryCount = config._retryCount ?? 0;

        const status: number | undefined = error.response?.status;
        const shouldRetry =
          config._retryCount < MAX_RETRIES &&
          (status === 429 ||
            (status !== undefined && status >= 500 && status < 600));

        if (!shouldRetry) return Promise.reject(error);

        config._retryCount += 1;
        const retryAfter = error.response?.headers?.["retry-after"];
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * 2 ** config._retryCount;

        if (status === 429) {
          logger.warn(
            `Intercom rate limit — retrying in ${delay}ms (attempt ${config._retryCount}/${MAX_RETRIES})`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.client.request(
          config as Parameters<typeof this.client.request>[0]
        );
      }
    );
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────

  /** Search for a contact by exact email match. */
  async searchByEmail(email: string): Promise<IntercomContact | null> {
    try {
      const response = await this.client.post("/contacts/search", {
        query: { field: "email", operator: "=", value: email },
      });
      return response.data.data?.[0] ?? null;
    } catch (error) {
      logger.error("Intercom searchByEmail error:", error);
      throw error;
    }
  }

  /** Fetch a full contact record by Intercom contact ID. */
  async getContact(id: string): Promise<IntercomContact | null> {
    try {
      const response = await this.client.get(`/contacts/${id}`);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404)
        return null;
      logger.error("Intercom getContact error:", error);
      throw error;
    }
  }

  /** Alias for unified search service compatibility. */
  async searchByUserId(userId: string): Promise<IntercomContact | null> {
    return this.getContact(userId);
  }

  /**
   * Cursor-paginated contact list (max 150 per page).
   * Pass the returned `nextCursor` as `startingAfter` for the next page.
   */
  async getAllContacts(
    limit = 100,
    startingAfter?: string
  ): Promise<{
    contacts: IntercomContact[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    try {
      const params: Record<string, unknown> = {
        per_page: Math.min(limit, 150),
      };
      if (startingAfter) params.starting_after = startingAfter;

      const response = await this.client.get("/contacts", { params });
      const contacts: IntercomContact[] = response.data.data || [];
      const pages = response.data.pages as { next?: string } | undefined;

      return {
        contacts,
        hasMore: Boolean(pages?.next),
        nextCursor:
          contacts.length > 0 ? contacts[contacts.length - 1].id : undefined,
      };
    } catch (error) {
      logger.error("Intercom getAllContacts error:", error);
      return { contacts: [], hasMore: false };
    }
  }

  /** Get all conversations linked to a specific contact. */
  async getContactConversations(
    contactId: string
  ): Promise<IntercomConversation[]> {
    try {
      const response = await this.client.get(
        `/contacts/${contactId}/conversations`
      );
      return response.data.conversations || [];
    } catch (error) {
      logger.error("Intercom getContactConversations error:", error);
      throw error;
    }
  }

  /** List notes attached to a contact. */
  async getContactNotes(contactId: string): Promise<unknown[]> {
    try {
      const response = await this.client.get(`/contacts/${contactId}/notes`);
      return response.data.data || [];
    } catch (error) {
      logger.error("Intercom getContactNotes error:", error);
      throw error;
    }
  }

  /** Add a note to a contact (requires a valid admin_id). */
  async createNote(
    contactId: string,
    body: string,
    adminId: string
  ): Promise<unknown> {
    try {
      const response = await this.client.post(`/contacts/${contactId}/notes`, {
        body,
        admin_id: adminId,
      });
      return response.data;
    } catch (error) {
      logger.error("Intercom createNote error:", error);
      throw error;
    }
  }

  // ─── Conversations ─────────────────────────────────────────────────────────

  /** Paginated conversation list with optional state filter. */
  async listConversations(params: {
    state?: "open" | "closed" | "snoozed" | "all";
    page?: number;
    perPage?: number;
    startingAfter?: string;
  }): Promise<IntercomPaginatedConversations> {
    try {
      const query: Record<string, unknown> = {
        per_page: params.perPage ?? 20,
      };
      if (params.state && params.state !== "all") query.state = params.state;
      if (params.page) query.page = params.page;
      if (params.startingAfter) query.starting_after = params.startingAfter;

      const response = await this.client.get("/conversations", {
        params: query,
      });
      return {
        conversations: response.data.conversations || [],
        total_count: response.data.total_count ?? 0,
        pages: response.data.pages ?? {
          page: 1,
          per_page: 20,
          total_pages: 1,
        },
      };
    } catch (error) {
      logger.error("Intercom listConversations error:", error);
      throw error;
    }
  }

  /** Fetch a single conversation including all parts (messages/notes). */
  async getConversation(id: string): Promise<IntercomConversation | null> {
    try {
      const response = await this.client.get(`/conversations/${id}`);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404)
        return null;
      logger.error("Intercom getConversation error:", error);
      throw error;
    }
  }

  /**
   * Reply to a conversation as an admin.
   * `adminId` must be a valid Intercom admin ID for your workspace.
   */
  async replyToConversation(
    conversationId: string,
    body: string,
    adminId: string
  ): Promise<IntercomConversation> {
    try {
      const response = await this.client.post(
        `/conversations/${conversationId}/reply`,
        {
          message_type: "comment",
          type: "admin",
          admin_id: adminId,
          body,
        }
      );
      return response.data;
    } catch (error) {
      logger.error("Intercom replyToConversation error:", error);
      throw error;
    }
  }

  /** Open, close, or snooze a conversation. */
  async updateConversationState(
    conversationId: string,
    state: "open" | "closed" | "snoozed",
    adminId: string,
    snoozeUntil?: number
  ): Promise<IntercomConversation> {
    try {
      const body: Record<string, unknown> = { state };
      if (state === "snoozed" && snoozeUntil) body.snoozed_until = snoozeUntil;

      const response = await this.client.put(
        `/conversations/${conversationId}`,
        body,
        { headers: { "Intercom-Admin-Id": adminId } }
      );
      return response.data;
    } catch (error) {
      logger.error("Intercom updateConversationState error:", error);
      throw error;
    }
  }

  /** Assign a conversation to an admin or team. */
  async assignConversation(
    conversationId: string,
    adminId: string,
    assigneeId: string
  ): Promise<IntercomConversation> {
    try {
      const response = await this.client.put(
        `/conversations/${conversationId}/parts`,
        {
          type: "assignment",
          admin_id: adminId,
          assignee_id: assigneeId,
        }
      );
      return response.data;
    } catch (error) {
      logger.error("Intercom assignConversation error:", error);
      throw error;
    }
  }

  // ─── Dashboard stats ────────────────────────────────────────────────────────

  async getConversationStats(): Promise<IntercomConversationStats> {
    const sevenDaysAgo = Math.floor(
      (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000
    );

    const [openRes, recentRes] = await Promise.all([
      this.client.get("/conversations", {
        params: { state: "open", per_page: 1 },
      }),
      this.client.get("/conversations", {
        params: { created_since: sevenDaysAgo, per_page: 150 },
      }),
    ]);

    const recent: IntercomConversation[] = recentRes.data.conversations || [];
    const repliedLast7Days = recent.filter(
      (c) => c.statistics?.last_contact_reply_at != null
    ).length;

    return {
      open:
        openRes.data.total_count ?? openRes.data.conversations?.length ?? 0,
      newLast7Days: recentRes.data.total_count ?? recent.length,
      repliedLast7Days,
    };
  }
}

export default IntercomService;
