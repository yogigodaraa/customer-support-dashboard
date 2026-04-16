import { google, gmail_v1 } from "googleapis";
import logger from "../utils/logger.js";

export type GmailChannel = "kyc" | "support";

export interface GmailThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  from: { name: string; email: string };
  lastMessageAt: string;
  messageCount: number;
  isUnread: boolean;
}

export interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  messageId: string;
}

export interface GmailMessage {
  id: string;
  from: { name: string; email: string };
  to: string;
  body: string;
  htmlBody: string | null;
  attachments: GmailAttachment[];
  created_at: string;
  is_inbound: boolean;
}

export interface GmailConversationStats {
  inbox: number;
  unread: number;
  newLast7Days: number;
}

class GmailService {
  private clients: Partial<Record<GmailChannel, gmail_v1.Gmail>> = {};
  private accountEmails: Record<GmailChannel, string> = { kyc: "", support: "" };
  readonly hasToken: boolean;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const kycRefresh = process.env.GMAIL_KYC_REFRESH_TOKEN || "";
    const supportRefresh = process.env.GMAIL_SUPPORT_REFRESH_TOKEN || "";

    this.hasToken = !!(clientId && clientSecret && (kycRefresh || supportRefresh));

    const makeClient = (refreshToken: string): gmail_v1.Gmail | null => {
      if (!refreshToken || !clientId || !clientSecret) return null;
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      return google.gmail({ version: "v1", auth });
    };

    const kycClient = makeClient(kycRefresh);
    const supportClient = makeClient(supportRefresh);
    if (kycClient) this.clients.kyc = kycClient;
    if (supportClient) this.clients.support = supportClient;
  }

  private gmail(channel: GmailChannel): gmail_v1.Gmail {
    const client = this.clients[channel];
    if (!client) throw new Error(`Gmail client not configured for channel: ${channel}`);
    return client;
  }

  /** Get the account's own email address (cached). */
  async getAccountEmail(channel: GmailChannel): Promise<string> {
    if (this.accountEmails[channel]) return this.accountEmails[channel];
    try {
      const profile = await this.gmail(channel).users.getProfile({ userId: "me" });
      this.accountEmails[channel] = profile.data.emailAddress || "";
    } catch (err) {
      logger.error("Gmail getProfile error:", err);
    }
    return this.accountEmails[channel];
  }

  /** Check if a channel is configured. */
  hasChannel(channel: GmailChannel): boolean {
    return !!this.clients[channel];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
    return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
  }

  private parseFrom(raw: string): { name: string; email: string } {
    // "John Doe <john@example.com>" or "john@example.com"
    const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) return { name: match[1].replace(/^"|"$/g, "").trim(), email: match[2] };
    return { name: raw, email: raw };
  }

  /** Recursively extract plain text body from MIME parts. */
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return "";

    if (payload.parts) {
      // Prefer text/plain
      const plain = payload.parts.find(p => p.mimeType === "text/plain");
      if (plain?.body?.data) return Buffer.from(plain.body.data, "base64url").toString("utf-8");
      // Fallback to text/html stripped
      const html = payload.parts.find(p => p.mimeType === "text/html");
      if (html?.body?.data) {
        const raw = Buffer.from(html.body.data, "base64url").toString("utf-8");
        return raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      }
      // Recurse into nested multipart
      for (const part of payload.parts) {
        const nested = this.extractBody(part);
        if (nested) return nested;
      }
    }

    // Simple single-part message
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, "base64url").toString("utf-8");
      if (payload.mimeType === "text/html") {
        return decoded.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      }
      return decoded;
    }

    return "";
  }

  /** Extract raw HTML body when available, otherwise null. */
  private extractHtmlBody(payload: gmail_v1.Schema$MessagePart | undefined): string | null {
    if (!payload) return null;
    if (payload.parts) {
      const html = payload.parts.find(p => p.mimeType === "text/html");
      if (html?.body?.data) return Buffer.from(html.body.data, "base64url").toString("utf-8");
      for (const part of payload.parts) {
        const nested = this.extractHtmlBody(part);
        if (nested) return nested;
      }
    }
    if (payload.mimeType === "text/html" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }
    return null;
  }

  /** Collect all attachment parts (non-inline, has filename + attachmentId). */
  private extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined, messageId: string): GmailAttachment[] {
    const results: GmailAttachment[] = [];
    if (!payload) return results;
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          results.push({
            filename: part.filename,
            mimeType: part.mimeType || "application/octet-stream",
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId,
            messageId,
          });
        }
        // Recurse into nested multipart
        results.push(...this.extractAttachments(part, messageId));
      }
    }
    return results;
  }

  /** Download raw attachment bytes from Gmail API. */
  async getAttachment(channel: GmailChannel, messageId: string, attachmentId: string): Promise<Buffer> {
    const gmail = this.gmail(channel);
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });
    return Buffer.from(res.data.data || "", "base64url");
  }

  // ─── Thread listing ───────────────────────────────────────────────────────────

  async listThreads(channel: GmailChannel, options: { q?: string; label?: string; maxResults?: number } = {}): Promise<{
    threads: GmailThreadSummary[];
    total: number;
  }> {
    const gmail = this.gmail(channel);

    // Map label param to Gmail label IDs
    let labelIds: string[] | undefined;
    let includeSpamTrash = false;
    switch (options.label) {
      case "archived":
        labelIds = undefined;
        break;
      case "spam":
        labelIds = ["SPAM"];
        includeSpamTrash = true;
        break;
      case "trash":
        labelIds = ["TRASH"];
        includeSpamTrash = true;
        break;
      case "promotions":
        labelIds = ["CATEGORY_PROMOTIONS"];
        break;
      default:
        labelIds = ["INBOX"];
        break;
    }
    const q = options.q || undefined;

    const listRes = await gmail.users.threads.list({
      userId: "me",
      labelIds,
      q,
      maxResults: options.maxResults || 50,
      includeSpamTrash,
    });

    const rawThreads = listRes.data.threads || [];
    if (rawThreads.length === 0) return { threads: [], total: 0 };

    // Fetch metadata for each thread (parallelized, max 10 at a time)
    const threads: GmailThreadSummary[] = [];
    const batchSize = 10;
    for (let i = 0; i < rawThreads.length; i += batchSize) {
      const batch = rawThreads.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(t =>
          gmail.users.threads.get({
            userId: "me",
            id: t.id!,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          })
        )
      );

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const thread = result.value.data;
        const msgs = thread.messages || [];
        const firstMsg = msgs[0];
        const lastMsg = msgs[msgs.length - 1];
        const headers = firstMsg?.payload?.headers;

        const subject = this.getHeader(headers, "Subject") || "(no subject)";
        const from = this.parseFrom(this.getHeader(headers, "From"));
        const date = lastMsg?.internalDate
          ? new Date(parseInt(lastMsg.internalDate)).toISOString()
          : new Date().toISOString();
        const isUnread = firstMsg?.labelIds?.includes("UNREAD") || false;

        threads.push({
          id: thread.id!,
          subject,
          snippet: thread.snippet || "",
          from,
          lastMessageAt: date,
          messageCount: msgs.length,
          isUnread,
        });
      }
    }

    return {
      threads,
      total: listRes.data.resultSizeEstimate || threads.length,
    };
  }

  // ─── Thread detail ────────────────────────────────────────────────────────────

  async getThread(channel: GmailChannel, threadId: string): Promise<{
    id: string;
    subject: string;
    from: { name: string; email: string };
    status: "inbox" | "archived";
    lastMessageAt: string;
    snippet: string;
    messages: GmailMessage[];
    labelIds: string[];
  }> {
    const gmail = this.gmail(channel);
    const accountEmail = await this.getAccountEmail(channel);

    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const thread = res.data;
    const msgs = thread.messages || [];
    const firstMsg = msgs[0];
    const lastMsg = msgs[msgs.length - 1];

    const subject = this.getHeader(firstMsg?.payload?.headers, "Subject") || "(no subject)";
    const from = this.parseFrom(this.getHeader(firstMsg?.payload?.headers, "From"));
    const labelIds = firstMsg?.labelIds || [];
    const status = labelIds.includes("INBOX") ? "inbox" : "archived";

    const lastDate = lastMsg?.internalDate
      ? new Date(parseInt(lastMsg.internalDate)).toISOString()
      : new Date().toISOString();

    const messages: GmailMessage[] = msgs.map(msg => {
      const hdrs = msg.payload?.headers;
      const msgFrom = this.parseFrom(this.getHeader(hdrs, "From"));
      const msgTo = this.getHeader(hdrs, "To");
      const date = msg.internalDate
        ? new Date(parseInt(msg.internalDate)).toISOString()
        : new Date().toISOString();
      const body = this.extractBody(msg.payload);
      const htmlBody = this.extractHtmlBody(msg.payload);
      const attachments = this.extractAttachments(msg.payload, msg.id!);
      const isInbound = msgFrom.email.toLowerCase() !== accountEmail.toLowerCase();

      return {
        id: msg.id!,
        from: msgFrom,
        to: msgTo,
        body,
        htmlBody,
        attachments,
        created_at: date,
        is_inbound: isInbound,
      };
    });

    return {
      id: thread.id!,
      subject,
      from,
      status,
      lastMessageAt: lastDate,
      snippet: thread.snippet || "",
      messages,
      labelIds,
    };
  }

  // ─── Send reply ───────────────────────────────────────────────────────────────

  async sendReply(channel: GmailChannel, threadId: string, replyBody: string): Promise<void> {
    const gmail = this.gmail(channel);
    const accountEmail = await this.getAccountEmail(channel);

    // Fetch the thread to get the last message headers
    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Message-ID"],
    });

    const msgs = threadRes.data.messages || [];
    const lastMsg = msgs[msgs.length - 1];
    const headers = lastMsg?.payload?.headers || [];

    const messageId = this.getHeader(headers, "Message-ID");
    const subject = this.getHeader(headers, "Subject");
    const originalFrom = this.getHeader(headers, "From");
    const originalTo = this.getHeader(headers, "To");

    // Reply to whoever sent the last message (if it was inbound), or to the original recipient
    const fromParsed = this.parseFrom(originalFrom);
    const replyTo = fromParsed.email.toLowerCase() === accountEmail.toLowerCase()
      ? originalTo  // We sent the last message, reply to the recipient
      : originalFrom;  // They sent the last message, reply to them

    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

    const rawMessage = [
      `From: ${accountEmail}`,
      `To: ${replyTo}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageId}`,
      `References: ${messageId}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      replyBody,
    ].join("\r\n");

    const encoded = Buffer.from(rawMessage).toString("base64url");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encoded, threadId },
    });
  }

  // ─── Archive ──────────────────────────────────────────────────────────────────

  async archive(channel: GmailChannel, threadId: string): Promise<void> {
    await this.gmail(channel).users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: { removeLabelIds: ["INBOX"] },
    });
  }

  // ─── Compose new email ─────────────────────────────────────────────────────────

  async sendNewEmail(channel: GmailChannel, to: string, subject: string, body: string): Promise<string> {
    const gmail = this.gmail(channel);
    const accountEmail = await this.getAccountEmail(channel);

    const rawMessage = [
      `From: ${accountEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\r\n");

    const encoded = Buffer.from(rawMessage).toString("base64url");
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encoded },
    });
    return res.data.id || "";
  }

  // ─── Drafts ────────────────────────────────────────────────────────────────────

  private buildRaw(from: string, to: string, subject: string, body: string): string {
    const raw = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\r\n");
    return Buffer.from(raw).toString("base64url");
  }

  async createDraft(channel: GmailChannel, to: string, subject: string, body: string): Promise<string> {
    const gmail = this.gmail(channel);
    const accountEmail = await this.getAccountEmail(channel);
    const encoded = this.buildRaw(accountEmail, to, subject, body);

    const res = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw: encoded } },
    });
    return res.data.id || "";
  }

  async updateDraft(channel: GmailChannel, draftId: string, to: string, subject: string, body: string): Promise<void> {
    const gmail = this.gmail(channel);
    const accountEmail = await this.getAccountEmail(channel);
    const encoded = this.buildRaw(accountEmail, to, subject, body);

    await gmail.users.drafts.update({
      userId: "me",
      id: draftId,
      requestBody: { message: { raw: encoded } },
    });
  }

  async listDrafts(channel: GmailChannel, maxResults = 50): Promise<{
    drafts: Array<{ id: string; subject: string; to: string; snippet: string; updatedAt: string }>;
    total: number;
  }> {
    const gmail = this.gmail(channel);
    const listRes = await gmail.users.drafts.list({ userId: "me", maxResults });
    const rawDrafts = listRes.data.drafts || [];
    if (rawDrafts.length === 0) return { drafts: [], total: 0 };

    const drafts: Array<{ id: string; subject: string; to: string; snippet: string; updatedAt: string }> = [];
    const batchSize = 10;
    for (let i = 0; i < rawDrafts.length; i += batchSize) {
      const batch = rawDrafts.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(d => gmail.users.drafts.get({
          userId: "me",
          id: d.id!,
          format: "metadata",
        }))
      );

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const draft = result.value.data;
        const msg = draft.message;
        const headers = msg?.payload?.headers;
        const subject = this.getHeader(headers, "Subject") || "(no subject)";
        const to = this.getHeader(headers, "To") || "";
        const date = msg?.internalDate
          ? new Date(parseInt(msg.internalDate)).toISOString()
          : new Date().toISOString();

        drafts.push({
          id: draft.id!,
          subject,
          to,
          snippet: msg?.snippet || "",
          updatedAt: date,
        });
      }
    }

    return { drafts, total: listRes.data.resultSizeEstimate || drafts.length };
  }

  async getDraft(channel: GmailChannel, draftId: string): Promise<{
    id: string; to: string; subject: string; body: string;
  }> {
    const gmail = this.gmail(channel);
    const res = await gmail.users.drafts.get({ userId: "me", id: draftId, format: "full" });
    const msg = res.data.message;
    const headers = msg?.payload?.headers;

    return {
      id: res.data.id!,
      to: this.getHeader(headers, "To") || "",
      subject: this.getHeader(headers, "Subject") || "",
      body: this.extractBody(msg?.payload),
    };
  }

  async sendDraft(channel: GmailChannel, draftId: string): Promise<void> {
    await this.gmail(channel).users.drafts.send({
      userId: "me",
      requestBody: { id: draftId },
    });
  }

  async deleteDraft(channel: GmailChannel, draftId: string): Promise<void> {
    await this.gmail(channel).users.drafts.delete({ userId: "me", id: draftId });
  }

  // ─── Trash / Spam ──────────────────────────────────────────────────────────────

  async moveToTrash(channel: GmailChannel, threadId: string): Promise<void> {
    await this.gmail(channel).users.threads.trash({ userId: "me", id: threadId });
  }

  async untrash(channel: GmailChannel, threadId: string): Promise<void> {
    await this.gmail(channel).users.threads.untrash({ userId: "me", id: threadId });
  }

  async markSpam(channel: GmailChannel, threadId: string): Promise<void> {
    await this.gmail(channel).users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] },
    });
  }

  async unspam(channel: GmailChannel, threadId: string): Promise<void> {
    await this.gmail(channel).users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: { removeLabelIds: ["SPAM"], addLabelIds: ["INBOX"] },
    });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────

  async getConversationStats(channel: GmailChannel): Promise<GmailConversationStats> {
    const gmail = this.gmail(channel);

    const [inboxRes, unreadRes, recentRes] = await Promise.all([
      gmail.users.threads.list({ userId: "me", labelIds: ["INBOX"], maxResults: 1 }),
      gmail.users.threads.list({ userId: "me", labelIds: ["INBOX", "UNREAD"], maxResults: 1 }),
      gmail.users.threads.list({ userId: "me", q: "newer_than:7d", maxResults: 1 }),
    ]);

    return {
      inbox: inboxRes.data.resultSizeEstimate || 0,
      unread: unreadRes.data.resultSizeEstimate || 0,
      newLast7Days: recentRes.data.resultSizeEstimate || 0,
    };
  }

  // ─── Search ───────────────────────────────────────────────────────────────────

  async searchByEmail(email: string): Promise<{ name: string; email: string; channel: GmailChannel } | null> {
    for (const channel of ["support", "kyc"] as GmailChannel[]) {
      if (!this.hasChannel(channel)) continue;
      try {
        const res = await this.gmail(channel).users.threads.list({
          userId: "me",
          q: `from:${email} OR to:${email}`,
          maxResults: 1,
        });
        if (res.data.threads && res.data.threads.length > 0) {
          const threadRes = await this.gmail(channel).users.threads.get({
            userId: "me",
            id: res.data.threads[0].id!,
            format: "metadata",
            metadataHeaders: ["From", "To"],
          });
          // Find the correct contact name: prioritize From headers where
          // the searched email is the sender (they'll have the real display name)
          const msgs = threadRes.data.messages || [];
          const emailLower = email.toLowerCase();

          // First pass: look for From headers matching the email (best source of name)
          for (const msg of msgs) {
            const from = this.parseFrom(this.getHeader(msg.payload?.headers, "From"));
            if (from.email.toLowerCase() === emailLower) {
              return { name: from.name, email: from.email, channel };
            }
          }

          // Second pass: check To headers for a display name
          for (const msg of msgs) {
            const to = this.parseFrom(this.getHeader(msg.payload?.headers, "To"));
            if (to.email.toLowerCase() === emailLower && to.name !== to.email) {
              return { name: to.name, email: to.email, channel };
            }
          }

          // Fallback: return the searched email with username as name
          return { name: email.split("@")[0], email, channel };
        }
      } catch (err) {
        logger.error(`Gmail searchByEmail error (${channel}):`, err);
      }
    }
    return null;
  }
}

export default GmailService;
