import rateLimit from "express-rate-limit";

// Sign-in / sign-up. Tight, because these are the endpoints worth guessing at.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts. Try again in a few minutes." } },
});

// Everything else under /api. Generous enough that normal browsing never sees
// it, low enough to make scripted enumeration of the directory tedious.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Slow down a moment." } },
});
