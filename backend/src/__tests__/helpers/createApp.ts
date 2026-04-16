import express, { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { z } from "zod";
import { requireAuth, requireRole, requireWriteAccess } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

/** Create a minimal Express app for testing middleware. */
export function createTestApp() {
  const app = express();
  app.use(express.json());

  // Public route
  app.get("/public", (_req, res) => res.json({ ok: true }));

  // Auth-protected route
  app.get("/protected", requireAuth, (req: Request, res: Response) => res.json({ user: req.user }));

  // Admin-only route
  app.get("/admin-only", requireAuth, requireRole("admin"), (_req, res) => res.json({ ok: true }));

  // Write-access routes (GET allowed for viewers, POST blocked)
  app.get("/write-test", requireAuth, requireWriteAccess, (_req, res) => res.json({ ok: true }));
  app.post("/write-test", requireAuth, requireWriteAccess, (_req, res) => res.json({ ok: true }));

  // Validation test route
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });
  app.post("/validate-test", validate({ body: testSchema }), (req: Request, res: Response) => {
    res.json({ data: req.body });
  });

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}
