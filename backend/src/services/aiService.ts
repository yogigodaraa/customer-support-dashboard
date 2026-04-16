import Anthropic from "@anthropic-ai/sdk";
import logger from "../utils/logger.js";

interface ConversationContext {
  source: string;
  conversationId: string;
  subject: string;
  contactName: string;
  contactEmail: string;
  messages: Array<{
    from: string;
    body: string;
    isInbound: boolean;
    createdAt: string;
  }>;
}

export interface AiChatRequest {
  message: string;
  conversationContext?: ConversationContext;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

export interface AiChatResponse {
  reply: string;
  model: string;
}

// Build a rich system prompt that gives Claude full context about WeSupport
function buildSystemPrompt(ctx?: ConversationContext): string {
  const base = [
    "You are an AI assistant embedded inside WeSupport, a unified customer support platform.",
    "You help support agents reply to customers faster, understand issues deeply, and improve customer satisfaction.",
    "Keep responses concise and practical. Use markdown formatting when it helps clarity.",
    "When drafting replies to customers, write in a professional but warm tone on behalf of the support team.",
  ].join(" ");

  if (!ctx) return base;

  const msgBlock = ctx.messages
    .slice(-10) // last 10 messages to keep context manageable
    .map((m) => {
      const dir = m.isInbound ? "Customer" : "Agent";
      const ts = new Date(m.createdAt).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `[${ts}] ${dir} (${m.from}): ${m.body}`;
    })
    .join("\n");

  return [
    base,
    "",
    "--- CURRENT CONVERSATION CONTEXT ---",
    `Source: ${ctx.source}`,
    `Contact: ${ctx.contactName} <${ctx.contactEmail}>`,
    `Subject: ${ctx.subject}`,
    "",
    "Conversation thread:",
    msgBlock,
    "--- END OF CONTEXT ---",
  ].join("\n");
}

class AiService {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      logger.info("AI service: using Anthropic claude-sonnet-4-6");
    } else {
      logger.warn("AI service: ANTHROPIC_API_KEY not set — using mock responses");
    }
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    if (this.client) {
      return this.callAnthropic(request);
    }
    return this.mockResponse(request);
  }

  private async callAnthropic(request: AiChatRequest): Promise<AiChatResponse> {
    const systemPrompt = buildSystemPrompt(request.conversationContext);

    // Build message history — only user/assistant roles for Anthropic
    const history = request.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history,
      { role: "user", content: request.message },
    ];

    logger.info("Calling Anthropic API", {
      model: "claude-sonnet-4-6",
      messageCount: messages.length,
      hasContext: !!request.conversationContext,
    });

    const response = await this.client!.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply =
      response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("") || "No response generated.";

    return { reply, model: "claude-sonnet-4-6" };
  }

  private async mockResponse(request: AiChatRequest): Promise<AiChatResponse> {
    logger.info("AI chat request (mock mode — set ANTHROPIC_API_KEY for real responses)", {
      messageLength: request.message.length,
      hasContext: !!request.conversationContext,
    });

    // Simulate realistic AI delay
    const delay = 600 + Math.random() * 800;
    await new Promise((r) => setTimeout(r, delay));

    const reply = this.generateMockResponse(request);
    return { reply, model: "mock-ai-v1" };
  }

  private generateMockResponse(request: AiChatRequest): string {
    const msg = request.message.toLowerCase();
    const ctx = request.conversationContext;
    const contactName = ctx?.contactName ?? "the customer";
    const subject = ctx?.subject ?? "their issue";

    if (msg.includes("summarize") || msg.includes("summary") || msg.includes("tldr")) {
      if (ctx?.messages?.length) {
        const inbound = ctx.messages.filter((m) => m.isInbound).length;
        const outbound = ctx.messages.filter((m) => !m.isInbound).length;
        return (
          `## Conversation Summary\n\n` +
          `**Customer:** ${contactName}\n` +
          `**Topic:** ${subject}\n` +
          `**Messages:** ${ctx.messages.length} (${inbound} inbound, ${outbound} outbound)\n\n` +
          `${contactName} reached out regarding "${subject}". ` +
          `The conversation has ${inbound} customer messages and ${outbound} agent responses.\n\n` +
          `**Key points:**\n` +
          `- Customer initiated contact about ${subject.toLowerCase()}\n` +
          `- The issue appears to be ${ctx.messages.length > 3 ? "ongoing" : "newly reported"}`
        );
      }
      return "No conversation loaded to summarize. Select a conversation first.";
    }

    if (msg.includes("draft") || msg.includes("reply") || msg.includes("respond")) {
      const firstName = contactName.split(" ")[0];
      return (
        `Here's a suggested reply to ${contactName}:\n\n---\n\n` +
        `Hi ${firstName},\n\n` +
        `Thanks for your patience while we looked into this.\n\n` +
        `Regarding ${subject.toLowerCase()}, I'd like to help you resolve this as quickly as possible. ` +
        `Could you provide any additional details or screenshots that might help us investigate?\n\n` +
        `We're committed to getting this sorted for you.\n\nBest regards`
      );
    }

    if (msg.includes("sentiment") || msg.includes("tone") || msg.includes("mood")) {
      return (
        `## Sentiment Analysis\n\n` +
        `**Overall tone:** Mildly frustrated but cooperative\n` +
        `**Urgency level:** Medium\n` +
        `**Customer satisfaction risk:** Moderate\n\n` +
        `The customer's language suggests they are experiencing friction but remain willing to work with the support team. ` +
        `Acknowledge their frustration explicitly and provide a clear next step.`
      );
    }

    if (msg.includes("analyze this message")) {
      return (
        `## Message Analysis\n\n` +
        `**Intent:** The customer is seeking resolution for ${subject.toLowerCase()}\n` +
        `**Emotion:** Slightly frustrated, direct\n` +
        `**Action required:** Yes — this message needs a response\n\n` +
        `**Suggested approach:**\n` +
        `1. Acknowledge their specific concern\n` +
        `2. Provide a concrete next step or timeline\n` +
        `3. Offer an alternative if the primary solution isn't immediately available`
      );
    }

    if (ctx) {
      return (
        `I can help you with this conversation about "${subject}" from ${contactName}.\n\n` +
        `Here are some things I can do:\n` +
        `- **Summarize** the conversation\n` +
        `- **Draft a reply** to the customer\n` +
        `- **Analyze sentiment** and urgency\n` +
        `- **Suggest next steps** or escalation\n\n` +
        `*(Set ANTHROPIC_API_KEY in the backend .env for real AI responses)*`
      );
    }

    return (
      `I'm your AI support assistant. I can help you:\n\n` +
      `- **Summarize** customer conversations\n` +
      `- **Draft replies** to customers\n` +
      `- **Analyze** message sentiment and urgency\n` +
      `- **Suggest** next steps\n\n` +
      `Select a conversation from Intercom or Gmail to get started.\n\n` +
      `*(Set ANTHROPIC_API_KEY in the backend .env for real AI responses)*`
    );
  }
}

export default new AiService();
