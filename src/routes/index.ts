import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { getPhoto } from "../services/user.service";
import { authRouter } from "./auth.routes";
import { directoryRouter } from "./directory.routes";
import { messagesRouter } from "./messages.routes";
import { usersRouter } from "./users.routes";
import { CITIES } from "../lib/place";
import { GENDER_OPTIONS, HOUSES, INDUSTRIES, PBHA_ROLES, PROGRAMS, RACE_OPTIONS } from "../lib/programs";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true }));

// Profile photos, served from the row they were uploaded into. Public on
// purpose: an <img> in the directory cannot carry an Authorization header,
// and the id is a cuid nobody can enumerate. Immutable caching is safe
// because a replaced photo gets a new id, and so a new URL.
apiRouter.get(
  "/photos/:id",
  asyncHandler(async (req, res) => {
    const photo = await getPhoto(req.params.id);
    if (!photo) return res.status(404).end();
    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(photo.data);
  }),
);

// The canonical program / role vocabulary, so the profile editor offers the
// same options the seed and the filters use without duplicating the list in
// the frontend.
apiRouter.get("/vocab", (_req, res) =>
  res.json({
    programs: PROGRAMS,
    roles: PBHA_ROLES,
    houses: HOUSES,
    industries: INDUSTRIES,
    genders: GENDER_OPTIONS,
    races: RACE_OPTIONS,
    cities: CITIES,
  }),
);

apiRouter.use("/auth", authRouter);
apiRouter.use("/directory", directoryRouter);
apiRouter.use("/messages", messagesRouter);
apiRouter.use("/users", usersRouter);
