import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { clearAccessTokenCookie, setAccessTokenCookie } from "../lib/auth";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { authLimiter } from "../middleware/rate-limit";
import { passwordField, signinSchema, signupSchema } from "../schemas/auth.schema";
import * as authService from "../services/auth.service";

export const authRouter = Router();

authRouter.post(
  "/signup",
  authLimiter,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.signup(req.body);
    setAccessTokenCookie(res, result.token);
    res.status(201).json({ userId: result.userId, claimed: result.claimed });
  }),
);

authRouter.post(
  "/signin",
  authLimiter,
  validate(signinSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.signin(req.body);
    setAccessTokenCookie(res, result.token);
    res.json({ userId: result.userId });
  }),
);

authRouter.post("/signout", (_req, res) => {
  clearAccessTokenCookie(res);
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await authService.me(req.auth!.sub));
  }),
);

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: passwordField })
  .strict();

authRouter.post(
  "/change-password",
  requireAuth,
  authLimiter,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.changePassword(
      req.auth!.sub,
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.status(204).end();
  }),
);
