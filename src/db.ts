import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// One client per process. In dev, `tsx watch` re-imports this module on every
// reload, so the instance is cached on globalThis to avoid exhausting the
// connection pool with a new client per edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
