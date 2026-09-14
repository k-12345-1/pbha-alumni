import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { photoUploadSchema, privacyUpdateSchema, profileUpdateSchema } from "../schemas/user.schema";
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

// A photo arrives as a base64 data URL in JSON rather than as multipart,
// so the request goes through the same body parser, validation and auth as
// every other write. The client downscales first; see the size cap in the
// service for what actually gets enforced.
usersRouter.put(
  "/me/photo",
  requireAuth,
  validate(photoUploadSchema),
  asyncHandler(async (req, res) => {
    res.json(await userService.setMyPhoto(req.auth!.sub, req.body.dataUrl));
  }),
);

usersRouter.delete(
  "/me/photo",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await userService.clearMyPhoto(req.auth!.sub));
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
