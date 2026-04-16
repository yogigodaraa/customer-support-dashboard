import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidateOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: { location: string; issues: ZodError["issues"] }[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push({ location: "body", issues: result.error.issues });
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push({ location: "query", issues: result.error.issues });
      } else {
        (req as any).query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push({ location: "params", issues: result.error.issues });
      } else {
        req.params = result.data as any;
      }
    }

    if (errors.length > 0) {
      const allIssues = errors.flatMap((e) =>
        e.issues.map((i) => ({
          ...i,
          path: [e.location, ...i.path],
        }))
      );
      res.status(400).json({
        error: "Validation failed",
        details: allIssues,
      });
      return;
    }

    next();
  };
}
