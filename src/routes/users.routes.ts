import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { privacyUpdateSchema, profileUpdateSchema } from "../schemas/user.schema";
import * as userService from "../services/user.service";

export const usersRouter = Router();

usersRouter.get(
  "/me/privacy",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await userService.getMyPrivacy(req.auth!.sub));
  }),
);

usersRouter.patch(
  "/me/privacy",
  requireAuth,
  validate(privacyUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json(await userService.updateMyPrivacy(req.auth!.sub, req.body));
  }),
);

usersRouter.patch(
  "/me",
  requireAuth,
  validate(profileUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json(await userService.updateMyProfile(req.auth!.sub, req.body));
  }),
);

// Keep the :id route last so "me" is never swallowed by the wildcard.
usersRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await userService.getProfile(req.params.id, req.auth!.sub));
  }),
);
