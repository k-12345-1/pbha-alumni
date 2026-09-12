import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { HttpError } from "../lib/errors";

type Source = "body" | "query" | "params";

export const validate =
  (schema: ZodTypeAny, source: Source = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path.join(".");
      return next(
        new HttpError(400, path ? `${path}: ${first.message}` : first.message, "VALIDATION"),
      );
    }
    // Express 5 makes req.query a getter; assigning through defineProperty
    // keeps this working on both 4 and 5.
    Object.defineProperty(req, source, { value: result.data, writable: true });
    next();
  };
