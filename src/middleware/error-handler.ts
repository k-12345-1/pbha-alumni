import type { NextFunction, Request, Response } from "express";
import { HttpError, NotFound } from "../lib/errors";
import { env } from "../env";

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(NotFound("Route not found"));
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof HttpError
      ? err.message
      : env.NODE_ENV === "production"
        ? "Something went wrong"
        : String((err as Error)?.message ?? err);

  // 5xx is ours to fix, so it always gets logged. 4xx is the caller's problem
  // and would just be noise.
  if (status >= 500) console.error("[error]", err);

  res.status(status).json({
    error: { message, code: err instanceof HttpError ? err.code : undefined },
  });
};
