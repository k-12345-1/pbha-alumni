import { buildApp } from "./server";
import { env } from "./env";
import { prisma } from "./db";

const app = buildApp();
const server = app.listen(env.PORT, () => {
  console.log(`PBHA Alumni Directory listening on http://localhost:${env.PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received — shutting down`);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  // Don't let a hung connection hold the dyno open past the host's grace
  // period; force the exit if close() has not finished in 10s.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
