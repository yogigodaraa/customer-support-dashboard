import { PrismaClient } from "@prisma/client";
import GmailService from "./gmailService.js";
import IntercomService from "./intercomService.js";
import LuciqService from "./luciqService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

/** Cache TTL for on-demand searches: 15 minutes */
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

interface UnifiedSearchResult {
  gmail: unknown[];
  intercom: unknown[];
  luciq: unknown[];
  timestamp: Date;
}

class UnifiedSearchService {
  private gmailService: GmailService;
  private intercomService: IntercomService;
  private luciqService: LuciqService;

  constructor() {
    this.gmailService = new GmailService();
    this.intercomService = new IntercomService(
      process.env.INTERCOM_ACCESS_TOKEN || ""
    );
    this.luciqService = new LuciqService(process.env.LUCIQ_API_KEY || "");
  }

  async searchByEmail(email: string): Promise<UnifiedSearchResult> {
    logger.info(`Unified search for email: ${email}`);

    const [gmailResult, intercomResult, luciqResults] = await Promise.all([
      this.gmailService.searchByEmail(email).catch((err) => {
        logger.warn("Gmail searchByEmail failed:", err);
        return null;
      }),
      this.intercomService.searchByEmail(email).catch((err) => {
        logger.warn("Intercom searchByEmail failed:", err);
        return null;
      }),
      this.luciqService.searchByEmail(email).catch((err) => {
        logger.warn("Luciq searchByEmail failed:", err);
        return [];
      }),
    ]);

    await this.cacheResults(email, {
      gmail: gmailResult,
      intercom: intercomResult,
      luciq: luciqResults,
    });

    return {
      gmail: gmailResult ? [gmailResult] : [],
      intercom: intercomResult ? [intercomResult] : [],
      luciq: luciqResults || [],
      timestamp: new Date(),
    };
  }

  async searchByUserId(userId: string): Promise<UnifiedSearchResult> {
    logger.info(`Unified search for user ID: ${userId}`);

    const [gmailResult, intercomResult, luciqResults] = await Promise.all([
      this.gmailService.searchByEmail(userId).catch(() => null),
      this.intercomService.searchByUserId(userId).catch(() => null),
      this.luciqService.searchByUserId(userId).catch(() => []),
    ]);

    await this.cacheResults(userId, {
      gmail: gmailResult,
      intercom: intercomResult,
      luciq: luciqResults,
    });

    return {
      gmail: gmailResult ? [gmailResult] : [],
      intercom: intercomResult ? [intercomResult] : [],
      luciq: luciqResults || [],
      timestamp: new Date(),
    };
  }

  private async cacheResults(
    identifier: string,
    data: Record<string, unknown>
  ) {
    const expiresAt = new Date(Date.now() + SEARCH_CACHE_TTL_MS);
    try {
      for (const [source, result] of Object.entries(data)) {
        if (result != null) {
          await prisma.cachedData.upsert({
            where: { source_identifier: { source, identifier } },
            update: {
              data: result as object,
              expiresAt,
              updatedAt: new Date(),
            },
            create: {
              source,
              identifier,
              data: result as object,
              expiresAt,
            },
          });
        }
      }
    } catch (error) {
      logger.error("Cache write error:", error);
    }
  }

  /**
   * Returns cached data for an identifier, skipping entries whose TTL has expired.
   * Returns an empty object when nothing valid is cached.
   */
  async getFromCache(identifier: string): Promise<Record<string, unknown>> {
    try {
      const cached = await prisma.cachedData.findMany({
        where: {
          identifier,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });
      return cached.reduce(
        (acc, item) => {
          acc[item.source] = item.data;
          return acc;
        },
        {} as Record<string, unknown>
      );
    } catch (error) {
      logger.error("Cache retrieval error:", error);
      return {};
    }
  }
}

export default UnifiedSearchService;
