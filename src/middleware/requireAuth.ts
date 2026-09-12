import type { NextFunction, Request, Response } from "express";
import { Forbidden, Unauthorized } from "../lib/errors";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken, type JwtPayload } from "../lib/auth";
import { prisma } from "../db";

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
};

type SessionState = "ok" | "gone" | "suspended" | "stale";

// One indexed PK lookup per request. Catches accounts suspended or deleted
// while a JWT was still in flight, and tokens superseded by a newer sign-in.
// Also refreshes `role` from the DB so a demotion takes effect immediately
// instead of persisting until the JWT expires.
const checkSession = async (auth: JwtPayload): Promise<SessionState> => {
  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: { status: true, lastTokenIssuedAt: true, role: true },
  });
  if (!user || user.status === "DELETED") return "gone";
  if (user.status === "SUSPENDED") return "suspended";
  if (
    auth.iat != null &&
    user.lastTokenIssuedAt &&
    auth.iat * 1000 < user.lastTokenIssuedAt.getTime()
  ) {
    return "stale";
  }
  auth.role = user.role;
  return "ok";
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) return next(Unauthorized());
  try {
    req.auth = verifyAccessToken(token);
  } catch {
    return next(Unauthorized("Invalid or expired token"));
  }
  checkSession(req.auth)
    .then((state) => {
      switch (state) {
        case "gone":
          return next(Unauthorized());
        case "suspended":
          return next(Unauthorized("Account is suspended"));
        case "stale":
          return next(Unauthorized("Signed in elsewhere"));
        case "ok":
          return next();
      }
    })
    .catch(next);
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.auth) return next(Unauthorized());
  if (req.auth.role !== "ADMIN") return next(Forbidden("Admin only"));
  next();
};
