import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:4000")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

  PUBLIC_URL: z.string().url().default("http://localhost:4000"),

  // Invite-code gate on signup. When set, signup must submit a matching
  // string (case-insensitive, trimmed). Blank allows open signup.
  SIGNUP_SECRET_CODE: z.string().optional().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
