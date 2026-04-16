import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import GmailService from "./gmailService.js";
import IntercomService from "./intercomService.js";
import LuciqService from "./luciqService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

/** How long synced contacts stay valid in the cache (30 minutes). */
const SYNC_CACHE_TTL_MS = 30 * 60 * 1000;

/** Safety cap: stop paginating after this many contacts per sync run. */
const MAX_CONTACTS_PER_SYNC = 1000;

class SyncService {
  private cronJob: cron.ScheduledTask | null = null;
  private gmailService: GmailService;
  private intercomService: IntercomService;
  private luciqService: LuciqService;
  private isRunning = false;

  constructor() {
    this.gmailService = new GmailService();
    this.intercomService = new IntercomService(
      process.env.INTERCOM_ACCESS_TOKEN || ""
    );
    this.luciqService = new LuciqService(process.env.LUCIQ_API_KEY || "");
  }

  start() {
    if (this.isRunning) {
      logger.warn("Sync service already running");
      return;
    }

    // Run every 5 minutes
    this.cronJob = cron.schedule("*/5 * * * *", async () => {
      await this.syncAll();
    });

    this.isRunning = true;
    logger.info("Sync service started (every 5 minutes)");
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      logger.info("Sync service stopped");
    }
  }

  private async syncAll() {
    await Promise.all([
      this.syncGmail(),
      this.syncIntercom(),
      this.syncLuciq(),
    ]);
  }

  private async syncGmail() {
    logger.info("Gmail sync: skipped (no contacts API)");
  }

  private async syncIntercom() {
    try {
      let cursor: string | undefined;
      let totalSynced = 0;
      const expiresAt = new Date(Date.now() + SYNC_CACHE_TTL_MS);

      do {
        const { contacts, hasMore, nextCursor } =
          await this.intercomService.getAllContacts(100, cursor);

        // Persist each contact to the cache keyed by both ID and email
        await Promise.all(
          contacts.flatMap((c) => {
            const ops: Promise<unknown>[] = [];

            // Cache by Intercom contact ID
            ops.push(
              prisma.cachedData
                .upsert({
                  where: {
                    source_identifier: { source: "intercom", identifier: c.id },
                  },
                  update: { data: c as object, expiresAt, updatedAt: new Date() },
                  create: {
                    source: "intercom",
                    identifier: c.id,
                    data: c as object,
                    expiresAt,
                  },
                })
                .catch((err) =>
                  logger.warn(`Cache upsert failed for contact ${c.id}:`, err)
                )
            );

            // Also cache by email so searchByEmail hits the cache
            if (c.email) {
              ops.push(
                prisma.cachedData
                  .upsert({
                    where: {
                      source_identifier: {
                        source: "intercom",
                        identifier: c.email,
                      },
                    },
                    update: {
                      data: c as object,
                      expiresAt,
                      updatedAt: new Date(),
                    },
                    create: {
                      source: "intercom",
                      identifier: c.email,
                      data: c as object,
                      expiresAt,
                    },
                  })
                  .catch((err) =>
                    logger.warn(
                      `Cache upsert failed for email ${c.email}:`,
                      err
                    )
                  )
              );
            }

            return ops;
          })
        );

        totalSynced += contacts.length;
        cursor = hasMore ? nextCursor : undefined;

        if (totalSynced >= MAX_CONTACTS_PER_SYNC) {
          logger.warn(
            `Intercom sync safety cap reached (${MAX_CONTACTS_PER_SYNC}); stopping pagination`
          );
          break;
        }
      } while (cursor);

      logger.info(`Intercom sync complete: ${totalSynced} contacts cached`);

      await prisma.syncLog.create({
        data: {
          source: "intercom",
          status: "success",
          message: `Synced ${totalSynced} contacts`,
          lastSync: new Date(),
          nextSync: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    } catch (error) {
      logger.error("Intercom sync error:", error);
      await prisma.syncLog.create({
        data: {
          source: "intercom",
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  private async syncLuciq() {
    try {
      const bugs = await this.luciqService.getAllBugs();
      logger.info(`Synced ${bugs.length} Luciq bugs`);

      await prisma.syncLog.create({
        data: {
          source: "luciq",
          status: "success",
          message: `Synced ${bugs.length} bugs`,
          lastSync: new Date(),
          nextSync: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    } catch (error) {
      logger.error("Luciq sync error:", error);
      await prisma.syncLog.create({
        data: {
          source: "luciq",
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
}

export default new SyncService();
