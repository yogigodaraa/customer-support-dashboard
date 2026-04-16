import { Request, Response, NextFunction } from "express";
import authService, { JwtPayload } from "../services/authService.js";
import logger from "../utils/logger.js";

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * requireAuth — Validates Bearer JWT token. Returns 401 if missing/invalid.
 * Attaches req.user = { userId, email, role }.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Bearer token required" });
    return;
  }
  try {
    const token = header.slice(7);
    req.user = authService.verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

/**
 * requireRole — Factory that checks req.user.role against allowed roles.
 * Must be used AFTER requireAuth.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/**
 * requireWriteAccess — Allows GET/HEAD/OPTIONS for all roles.
 * Blocks POST/PUT/PATCH/DELETE for viewers with 403.
 * Must be used AFTER requireAuth.
 */
export function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  const readMethods = ["GET", "HEAD", "OPTIONS"];
  if (readMethods.includes(req.method)) {
    next();
    return;
  }
  if (req.user?.role === "viewer") {
    res.status(403).json({ error: "Forbidden", message: "Viewers have read-only access" });
    return;
  }
  next();
}

/**
 * requireApiKey — Legacy API_SECRET guard (kept for webhook/external use).
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.API_SECRET;
  if (!secret) { next(); return; }

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn(`Unauthorized request to ${req.method} ${req.path}`);
    res.status(401).json({ error: "Unauthorized", message: "Provide Authorization: Bearer <API_SECRET> header" });
    return;
  }

  const provided = authHeader.slice("Bearer ".length).trim();
  if (provided !== secret) {
    logger.warn(`Invalid API key for ${req.method} ${req.path}`);
    res.status(403).json({ error: "Forbidden", message: "Invalid API key" });
    return;
  }
  next();
}
