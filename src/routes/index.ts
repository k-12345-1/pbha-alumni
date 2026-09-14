import { Router } from "express";
import { authRouter } from "./auth.routes";
import { directoryRouter } from "./directory.routes";
import { messagesRouter } from "./messages.routes";
import { usersRouter } from "./users.routes";
import { GENDER_OPTIONS, HOUSES, INDUSTRIES, PBHA_ROLES, PROGRAMS, RACE_OPTIONS } from "../lib/programs";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true }));

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
  }),
);

apiRouter.use("/auth", authRouter);
apiRouter.use("/directory", directoryRouter);
apiRouter.use("/messages", messagesRouter);
apiRouter.use("/users", usersRouter);
