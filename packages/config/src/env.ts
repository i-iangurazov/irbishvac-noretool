import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { z } from "zod";

function findWorkspaceRoot(startDir: string) {
  let current = startDir;

  while (true) {
    if (
      existsSync(resolve(current, "pnpm-workspace.yaml")) ||
      existsSync(resolve(current, "turbo.json"))
    ) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      return startDir;
    }

    current = parent;
  }
}

const workspaceRoot = findWorkspaceRoot(process.cwd());

function loadWorkspaceEnvFiles() {
  if (process.env.__IRBIS_ENV_FILES_LOADED === "true") {
    return;
  }

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const fileCandidates =
    nodeEnv === "test"
      ? [".env", `.env.${nodeEnv}`]
      : [".env", `.env.${nodeEnv}`, ".env.local", `.env.${nodeEnv}.local`];
  const mergedFromFiles: Record<string, string> = {};

  for (const fileName of fileCandidates) {
    const filePath = resolve(workspaceRoot, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    Object.assign(mergedFromFiles, parse(readFileSync(filePath)));
  }

  for (const [key, value] of Object.entries(mergedFromFiles)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  process.env.__IRBIS_ENV_FILES_LOADED = "true";
}

loadWorkspaceEnvFiles();

const csvNumbers = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(part)),
  )
  .pipe(z.array(z.number().int().nonnegative()));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_TIMEZONE: z.string().default("America/Los_Angeles"),
  ENABLE_DASHBOARD_FALLBACKS: z.enum(["true", "false"]).optional(),
  WORKER_BOOTSTRAP_ON_START: z.enum(["true", "false"]).optional(),
  DATABASE_URL: z.string().min(1),
  RETOOL_DATABASE_URL: z.string().optional().default(""),
  REDIS_URL: z.string().min(1),
  SENTRY_DSN: z.string().optional().default(""),
  AUTH_COOKIE_SECRET: z.string().min(1),
  AUTH_DEFAULT_ADMIN_EMAIL: z.string().email(),
  AUTH_DEFAULT_ADMIN_PASSWORD: z.string().min(8),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  SERVICETITAN_CLIENT_ID: z.string().min(1),
  SERVICETITAN_CLIENT_SECRET: z.string().min(1),
  SERVICETITAN_APP_KEY: z.string().default(""),
  SERVICETITAN_TENANT_ID: z.string().min(1),
  ST_REPORT_TECHNICIANS: z.string().min(1),
  ST_REPORT_INSTALLERS: z.string().min(1),
  ST_REPORT_ADVISORS: z.string().min(1),
  ST_REPORT_CALL_CENTER_SOURCE: z.string().min(1),
  ST_REPORT_CALL_CENTER_PERFORMANCE: z.string().min(1),
  ST_REPORT_LEADS: z.string().min(1),
  ST_REPORT_CAMPAIGNS: z.string().min(1),
  ST_REPORT_BOOKING_RATE: z.string().min(1),
  ST_REPORT_TRENDING: z.string().min(1),
  ST_REPORT_SALES: z.string().min(1),
  ST_REPORT_REVENUE_MONTHLY_PACE: z.string().min(1),
  ST_REPORT_CAPACITY_CATEGORY: z.string().optional().default(""),
  ST_REPORT_CAPACITY_ID: z.string().optional().default(""),
  ST_REPORT_JOB_COSTING_CATEGORY: z.string().optional().default(""),
  ST_REPORT_JOB_COSTING_ID: z.string().optional().default(""),
  ST_REPORT_REVENUE_GOALS_CATEGORY: z.string().optional().default(""),
  ST_REPORT_REVENUE_GOALS_ID: z.string().optional().default(""),
  ST_BU_INSTALLERS: csvNumbers,
  ST_BU_ADVISORS: csvNumbers,
  ST_BU_COMPANY: csvNumbers,
  R2_PUBLIC_BASE_URL: z.string().optional().default(""),
  R2_TECHNICIAN_PHOTO_EXT: z.string().optional().default("png"),
  R2_TECHNICIAN_PHOTO_NAME_STYLE: z
    .enum(["slug", "underscore", "space"])
    .optional()
    .default("space"),
  R2_LOGO_KEY: z.string().optional().default("irbis-logo_new_cmyk.png"),
  ASSET_FOLDER_TECHNICIAN_PHOTOS: z.string().optional().default("technicians_photos"),
  ASSET_FOLDER_LOGOS: z.string().optional().default("")
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(overrides?: Partial<Record<keyof AppEnv, unknown>>): AppEnv {
  if (!overrides && cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.parse({
    ...process.env,
    ...overrides
  });

  if (!overrides) {
    cachedEnv = parsed;
  }

  return parsed;
}
