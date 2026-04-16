import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

const router = Router();
const prisma = new PrismaClient();

// Get sync logs
router.get("/sync-logs", async (req: Request, res: Response) => {
  try {
    const { source, limit = "20" } = req.query;

    // Return mock logs for demo
    const mockLogs = [
      {
        id: "log_1",
        source: "gmail",
        status: "success" as const,
        message: "Synced 42 contacts",
        lastSync: new Date(Date.now() - 5 * 60 * 1000),
        nextSync: new Date(Date.now() + 55 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: "log_2",
        source: "intercom",
        status: "success" as const,
        message: "Synced 156 contacts",
        lastSync: new Date(Date.now() - 5 * 60 * 1000),
        nextSync: new Date(Date.now() + 55 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: "log_3",
        source: "luciq",
        status: "success" as const,
        message: "Synced 23 bugs",
        lastSync: new Date(Date.now() - 5 * 60 * 1000),
        nextSync: new Date(Date.now() + 55 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    ];

    try {
      const logs = await prisma.syncLog.findMany({
        where: source ? { source: source as string } : {},
        orderBy: { createdAt: "desc" },
        take: parseInt(limit as string),
      });

      if (logs.length > 0) {
        return res.json(logs);
      }
    } catch (dbError) {
      logger.info("Using mock sync logs");
    }

    const filtered = source
      ? mockLogs.filter((l) => l.source === source)
      : mockLogs;
    res.json(filtered.slice(0, parseInt(limit as string)));
  } catch (error) {
    logger.error("Error fetching sync logs:", error);
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

// Get integration status
router.get("/status", async (req: Request, res: Response) => {
  try {
    // Return mock status for demo
    const mockStatus = {
      gmail: {
        status: "success",
        lastSync: new Date(Date.now() - 5 * 60 * 1000),
        nextSync: new Date(Date.now() + 55 * 60 * 1000),
        message: "Synced 42 contacts",
      },
      intercom: {
        status: "success",
        lastSync: new Date(Date.now() - 5 * 60 * 1000),
        nextSync: new Date(Date.now() + 55 * 60 * 1000),
        message: "Synced 156 contacts",
      },
      luciq: {
        status: "success",
        lastSync: new Date(Date.now() - 5 * 60 * 1000),
        nextSync: new Date(Date.now() + 55 * 60 * 1000),
        message: "Synced 23 bugs",
      },
    };

    try {
      const latestLogs = await prisma.syncLog.findMany({
        distinct: ["source"],
        orderBy: { createdAt: "desc" },
        take: 3,
      });

      if (latestLogs.length > 0) {
        for (const log of latestLogs) {
          mockStatus[log.source as keyof typeof mockStatus] = {
            status: log.status as "success" | "failed" | "pending",
            lastSync: log.lastSync ?? new Date(),
            nextSync: log.nextSync ?? new Date(),
            message: log.message ?? "",
          };
        }
      }
    } catch (dbError) {
      logger.info("Using mock status data");
    }

    res.json(mockStatus);
  } catch (error) {
    logger.error("Error fetching integration status:", error);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

export default router;
