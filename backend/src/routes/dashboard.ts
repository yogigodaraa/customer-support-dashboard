import { Router, Request, Response } from "express";
import dashboardService from "../services/dashboardService.js";
import logger from "../utils/logger.js";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "7days";
    const validPeriod = ["7days","30days","90days"].includes(period) ? period as "7days"|"30days"|"90days" : "7days";
    const stats = await dashboardService.getStats(validPeriod);
    res.json(stats);
  } catch (error) {
    logger.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

export default router;
