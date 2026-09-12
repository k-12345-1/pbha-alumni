import { Router } from "express";
import { authRouter } from "./auth.routes";
import { directoryRouter } from "./directory.routes";
import { usersRouter } from "./users.routes";
import { PBHA_ROLES, PROGRAMS } from "../lib/programs";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true }));

// The canonical program / role vocabulary, so the profile editor offers the
// same options the seed and the filters use without duplicating the list in
// the frontend.
apiRouter.get("/vocab", (_req, res) => res.json({ programs: PROGRAMS, roles: PBHA_ROLES }));

apiRouter.use("/auth", authRouter);
apiRouter.use("/directory", directoryRouter);
apiRouter.use("/users", usersRouter);
