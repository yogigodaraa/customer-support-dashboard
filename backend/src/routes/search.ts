import { Router, Request, Response } from "express";
import UnifiedSearchService from "../services/unifiedSearchService.js";
import { validate } from "../middleware/validate.js";
import { searchBodySchema, cachedQuerySchema } from "../schemas/search.js";
import logger from "../utils/logger.js";

const router = Router();
const searchService = new UnifiedSearchService();

// POST /api/search
router.post("/", validate({ body: searchBodySchema }), async (req: Request, res: Response) => {
  try {
    const { email, userId, source } = req.body;

    const identifier = email?.trim() || userId!.trim();

    // ── Cache check ─────────────────────────────────────────────────────────
    const cached = await searchService.getFromCache(identifier);
    if (Object.keys(cached).length > 0) {
      logger.info(`Cache hit for ${identifier}`);
      if (source) {
        return res.json({
          [source]: cached[source] ?? [],
          timestamp: new Date(),
        });
      }
      return res.json({ ...cached, timestamp: new Date() });
    }

    // ── Live search ─────────────────────────────────────────────────────────
    let results;
    if (email) {
      results = await searchService.searchByEmail(email.trim());
    } else {
      results = await searchService.searchByUserId(userId!.trim());
    }

    // ── Optional source filter ───────────────────────────────────────────────
    if (source) {
      return res.json({
        [source]: results[source as keyof typeof results] ?? [],
        timestamp: results.timestamp,
      });
    }

    res.json(results);
  } catch (error) {
    logger.error("Search error:", error);
    res.status(500).json({
      error: "Search failed",
      message:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
});

// GET /api/search/cached
router.get("/cached", validate({ query: cachedQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { identifier } = req.query as { identifier: string };

    const cached = await searchService.getFromCache(identifier.trim());
    res.json(cached);
  } catch (error) {
    logger.error("Cache retrieval error:", error);
    res.status(500).json({ error: "Failed to retrieve cache" });
  }
});

export default router;
