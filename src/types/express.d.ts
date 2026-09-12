import type { JwtPayload } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
      id?: string;
    }
  }
}

export {};
