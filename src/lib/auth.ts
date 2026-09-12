import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import type { Response } from "express";
import { env } from "../env";

export const ACCESS_TOKEN_COOKIE = "pbha_access_token";

// httpOnly puts the token out of JS reach, so an XSS regression cannot lift
// it. SameSite=Lax keeps it attached on top-level navigation but drops it on
// cross-site POSTs. No maxAge / expires: the cookie is session-scoped, so
// closing the browser signs the member out.
export const setAccessTokenCookie = (res: Response, token: string): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
};

export const clearAccessTokenCookie = (res: Response): void => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
};

export interface JwtPayload {
  sub: string;
  email: string;
  role: "ALUM" | "ADMIN";
  iat?: number;
}

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, env.BCRYPT_COST);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

// Returns the iat alongside the token so the caller can stamp
// lastTokenIssuedAt with the exact second the JWT claims, rather than a fresh
// Date.now() that may have crossed a second boundary and would invalidate the
// token on its very first request.
export const signAccessToken = (
  payload: Omit<JwtPayload, "iat">,
): { token: string; iat: number } => {
  const iat = Math.floor(Date.now() / 1000);
  const token = jwt.sign({ ...payload, iat }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
  return { token, iat };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  // Pin the algorithm — defense in depth against a future change that swaps
  // JWT_SECRET for a public key and opens an algorithm-confusion downgrade.
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded === "string" || !decoded) throw new Error("Invalid token payload");
  return decoded as JwtPayload;
};

export const randomToken = (): string => crypto.randomBytes(32).toString("base64url");
