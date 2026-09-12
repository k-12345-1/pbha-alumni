import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env } from "./env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { apiLimiter } from "./middleware/rate-limit";

export const buildApp = () => {
  const app = express();

  // Render and most hosts sit behind one proxy; without this req.ip is the
  // proxy and the rate limiters key every visitor to the same bucket.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // The SPA compiles its JSX in the browser with Babel standalone,
          // which needs unsafe-inline and unsafe-eval. Everything else is
          // pinned to an explicit origin allowlist.
          scriptSrc: ["'self'", "https://unpkg.com", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin requests and curl send no Origin header.
        if (!origin) return cb(null, true);
        cb(null, env.CORS_ORIGINS.includes(origin));
      },
      credentials: true,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use("/api", apiLimiter, apiRouter);

  const publicDir = path.resolve(__dirname, "..", "public");
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));

  // The SPA owns its own routing, so any non-API GET falls through to the
  // shell. API 404s still return JSON via notFoundHandler below.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
