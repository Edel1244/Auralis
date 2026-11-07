import "server-only";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("auralis"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("AURALIS <no-reply@auralis.local>"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(200),
  DEFAULT_STORAGE_QUOTA_MB: z.coerce.number().int().positive().default(2048),
  REQUIRE_VERIFIED_EMAIL_FOR_UPLOAD: bool,
  /** When set, only this address becomes admin, and only after verifying it. */
  BOOTSTRAP_ADMIN_EMAIL: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.email("BOOTSTRAP_ADMIN_EMAIL must be an email address").optional()),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated server configuration. Throws a readable error on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid AURALIS configuration:\n${issues}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
