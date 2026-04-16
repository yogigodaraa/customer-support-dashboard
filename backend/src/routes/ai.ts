import { Router, Request, Response } from "express";
import aiService from "../services/aiService.js";
import { validate } from "../middleware/validate.js";
import { aiChatSchema } from "../schemas/ai.js";
import logger from "../utils/logger.js";

const router = Router();

// POST /api/ai/chat
router.post("/chat", validate({ body: aiChatSchema }), async (req: Request, res: Response) => {
  try {
    const { message, conversationContext, history } = req.body;

    const trimmedHistory = Array.isArray(history) ? history.slice(-20) : [];

    logger.info("AI chat request", {
      messagePreview: message.slice(0, 80),
      hasContext: !!conversationContext,
    });

    const response = await aiService.chat({
      message: message.trim(),
      conversationContext,
      history: trimmedHistory,
    });

    res.json(response);
  } catch (error) {
    logger.error("Error in AI chat:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

export default router;
