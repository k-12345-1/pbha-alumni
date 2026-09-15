import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import * as messagesService from "../services/messages.service";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ threads: await messagesService.listThreads(req.auth!.sub) });
  }),
);

messagesRouter.get(
  "/unread",
  asyncHandler(async (req, res) => {
    res.json({ unread: await messagesService.unreadTotal(req.auth!.sub) });
  }),
);

const openSchema = z.object({ userId: z.string().min(1).max(60) }).strict();

messagesRouter.post(
  "/open",
  validate(openSchema),
  asyncHandler(async (req, res) => {
    res.json(await messagesService.openThread(req.auth!.sub, req.body.userId));
  }),
);

messagesRouter.get(
  "/:threadId",
  asyncHandler(async (req, res) => {
    res.json(await messagesService.getThread(req.params.threadId, req.auth!.sub));
  }),
);

// 4,000 characters is a long note but not an essay, and it keeps a single
// row from carrying something that belongs in an attachment.
const sendSchema = z.object({ body: z.string().trim().min(1).max(4000) }).strict();

messagesRouter.post(
  "/:threadId",
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await messagesService.sendMessage(req.params.threadId, req.auth!.sub, req.body.body),
    );
  }),
);

messagesRouter.post(
  "/:threadId/read",
  asyncHandler(async (req, res) => {
    await messagesService.markRead(req.params.threadId, req.auth!.sub);
    res.status(204).end();
  }),
);

// Deletes this person's copy of the conversation. The other participant's
// is untouched; see clearThread.
messagesRouter.delete(
  "/:threadId",
  asyncHandler(async (req, res) => {
    res.json(await messagesService.clearThread(req.params.threadId, req.auth!.sub));
  }),
);
