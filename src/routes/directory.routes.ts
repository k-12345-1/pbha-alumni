import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { directoryQuerySchema, type DirectoryQuery } from "../schemas/user.schema";
import * as directoryService from "../services/directory.service";

export const directoryRouter = Router();

// Sign-in only, both of them. An open directory endpoint lets anyone
// paginate the full roster and harvest names, careers, and locations — which
// is exactly what "visible to other members" is meant to exclude.
directoryRouter.get(
  "/",
  requireAuth,
  validate(directoryQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const result = await directoryService.searchDirectory(
      req.query as unknown as DirectoryQuery,
      req.auth!.sub,
    );
    res.json(result);
  }),
);

directoryRouter.get(
  "/facets",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await directoryService.getDirectoryFacets());
  }),
);
