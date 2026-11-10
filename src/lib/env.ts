/**
 * Strict runtime environment validation (Zod).
 *
 * Used by Next.js instrumentation / build, the secrets CLI, and CI so missing
 * Stripe / DB / Sentry / Resend / LLM credentials fail fast instead of at
 * first request.
 *
 * Modes (ENV_VALIDATION or options.mode):
 *   - strict — throw on missing required keys (default in production/staging)
 *   - warn   — log issues, continue (default in development)
 *   - off    — skip (tests / SKIP_ENV_VALIDATION=1)
 */

import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const nonEmpty = z.preprocess(
  emptyToUndefined,
  z.string().min(1, "must not be empty"),
);

const optionalNonEmpty = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

/** Core server schema — required for any deployed environment. */
export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: nonEmpty,
  DATABASE_READ_REPLICA_URL: optionalNonEmpty,
  DATABASE_REPLICA_EU_URL: optionalNonEmpty,
  DATABASE_REPLICA_US_URL: optionalNonEmpty,
  DATABASE_REPLICA_APAC_URL: optionalNonEmpty,

  AUTH_SECRET: nonEmpty,
  AUTH_URL: optionalUrl,
  AUTH_GOOGLE_ID: optionalNonEmpty,
  AUTH_GOOGLE_SECRET: optionalNonEmpty,

  NEXT_PUBLIC_APP_URL: optionalUrl,
  APP_URL: optionalUrl,

  STRIPE_SECRET_KEY: optionalNonEmpty,
  STRIPE_WEBHOOK_SECRET: optionalNonEmpty,
  STRIPE_PRICE_PRO: optionalNonEmpty,
  STRIPE_PRICE_UNLIMITED: optionalNonEmpty,
  STRIPE_PRICE_SUBSCRIPTION: optionalNonEmpty,
  STRIPE_PRICE_CREDITS: optionalNonEmpty,

  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_ORG: optionalNonEmpty,
  SENTRY_PROJECT: optionalNonEmpty,
  SENTRY_AUTH_TOKEN: optionalNonEmpty,

  RESEND_API_KEY: optionalNonEmpty,
  SENDGRID_API_KEY: optionalNonEmpty,
  EMAIL_SERVER: optionalNonEmpty,
  EMAIL_FROM: optionalNonEmpty,

  OPENAI_API_KEY: optionalNonEmpty,
  ANTHROPIC_API_KEY: optionalNonEmpty,
  DEEPGRAM_API_KEY: optionalNonEmpty,

  REDIS_URL: optionalNonEmpty,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmpty,

  CRON_SECRET: optionalNonEmpty,
  HEALTH_PING_SECRET: optionalNonEmpty,
  ADMIN_EMAILS: optionalNonEmpty,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvValidationMode = "strict" | "warn" | "off";

export type EnvIssue = {
  path: string;
  message: string;
  severity: "error" | "warn";
};

export type EnvValidationResult = {
  ok: boolean;
  mode: EnvValidationMode;
  env: ServerEnv | null;
  issues: EnvIssue[];
};

/** Keys that must be present outside local development / test. */
export const PRODUCTION_REQUIRED_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

/** Soft requirements — warn when absent in production (feature degradation). */
export const PRODUCTION_RECOMMENDED_KEYS = [
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_APP_URL",
  "REDIS_URL",
] as const;

function resolveDeployProfile(
  source: NodeJS.ProcessEnv,
): "production" | "staging" | "development" | "test" {
  const explicit =
    source.SENTRY_ENVIRONMENT?.trim() ||
    source.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    source.APP_ENV?.trim() ||
    source.RAILWAY_ENVIRONMENT?.trim();
  if (explicit === "staging" || explicit === "stage" || explicit === "qa") {
    return "staging";
  }
  if (explicit === "production" || explicit === "prod") return "production";
  if (source.NODE_ENV === "test") return "test";
  if (source.NODE_ENV === "production") return "production";
  return "development";
}

export function resolveEnvValidationMode(
  source: NodeJS.ProcessEnv = process.env,
  override?: EnvValidationMode,
): EnvValidationMode {
  if (override) return override;
  if (
    source.SKIP_ENV_VALIDATION === "1" ||
    source.SKIP_ENV_VALIDATION === "true"
  ) {
    return "off";
  }
  const raw = source.ENV_VALIDATION?.trim().toLowerCase();
  if (raw === "strict" || raw === "warn" || raw === "off") return raw;

  const profile = resolveDeployProfile(source);
  if (profile === "production" || profile === "staging") return "strict";
  if (profile === "test") return "off";
  return "warn";
}

function collectProductionIssues(
  source: NodeJS.ProcessEnv,
  profile: "production" | "staging",
): EnvIssue[] {
  const issues: EnvIssue[] = [];
  for (const key of PRODUCTION_REQUIRED_KEYS) {
    if (!source[key]?.trim()) {
      issues.push({
        path: key,
        message: `required in ${profile}`,
        severity: "error",
      });
    }
  }

  // Email delivery — warn until a domain/Resend (or SMTP) is configured.
  // Magic-link / receipts degrade without it, but deploys should not hard-block.
  if (
    !source.RESEND_API_KEY?.trim() &&
    !source.SENDGRID_API_KEY?.trim() &&
    !source.EMAIL_SERVER?.trim()
  ) {
    issues.push({
      path: "RESEND_API_KEY|SENDGRID_API_KEY|EMAIL_SERVER",
      message: `no email provider configured in ${profile} (add Resend/SMTP when domain is ready)`,
      severity: "warn",
    });
  }

  // At least one LLM provider for coaching.
  if (!source.OPENAI_API_KEY?.trim() && !source.ANTHROPIC_API_KEY?.trim()) {
    issues.push({
      path: "OPENAI_API_KEY|ANTHROPIC_API_KEY",
      message: `at least one LLM API key required in ${profile}`,
      severity: "error",
    });
  }

  if (!source.AUTH_URL?.trim() && !source.NEXT_PUBLIC_APP_URL?.trim()) {
    issues.push({
      path: "AUTH_URL|NEXT_PUBLIC_APP_URL",
      message: `public app URL required in ${profile}`,
      severity: "error",
    });
  }

  for (const key of PRODUCTION_RECOMMENDED_KEYS) {
    if (!source[key]?.trim()) {
      // Skip keys already covered as hard errors above.
      if (
        key === "RESEND_API_KEY" ||
        key === "OPENAI_API_KEY" ||
        key === "NEXT_PUBLIC_APP_URL"
      ) {
        continue;
      }
      issues.push({
        path: key,
        message: `recommended in ${profile}`,
        severity: "warn",
      });
    }
  }

  return issues;
}

/**
 * Validate `process.env` (or a provided map). Never logs secret values —
 * only key paths and messages.
 */
export function validateEnv(options?: {
  source?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  mode?: EnvValidationMode;
  /** When true, throw on error-severity issues regardless of warn mode messaging. */
  throwOnError?: boolean;
}): EnvValidationResult {
  const source = (options?.source ?? process.env) as NodeJS.ProcessEnv;
  const mode = resolveEnvValidationMode(source, options?.mode);

  if (mode === "off") {
    return { ok: true, mode, env: null, issues: [] };
  }

  const parsed = serverEnvSchema.safeParse(source);
  const issues: EnvIssue[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
        severity: "error",
      });
    }
  }

  const profile = resolveDeployProfile(source);
  if (profile === "production" || profile === "staging") {
    issues.push(...collectProductionIssues(source, profile));
  }

  const errors = issues.filter((i) => i.severity === "error");
  const result: EnvValidationResult = {
    ok: errors.length === 0,
    mode,
    env: parsed.success ? parsed.data : null,
    issues,
  };

  if (issues.length > 0) {
    const lines = issues.map(
      (i) => `  [${i.severity.toUpperCase()}] ${i.path}: ${i.message}`,
    );
    const summary = `Environment validation (${mode}): ${errors.length} error(s), ${
      issues.length - errors.length
    } warning(s)\n${lines.join("\n")}`;

    const shouldThrow = options?.throwOnError ?? mode === "strict";
    if (shouldThrow && errors.length > 0) {
      throw new Error(summary);
    }
    console.warn(summary);
  }

  return result;
}

/** Assert env is valid — used at Next.js startup / build. */
export function assertEnv(options?: {
  source?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  mode?: EnvValidationMode;
}): ServerEnv | null {
  const source = (options?.source ?? process.env) as NodeJS.ProcessEnv;
  const result = validateEnv({
    ...options,
    source,
    throwOnError:
      (options?.mode ?? resolveEnvValidationMode(source)) === "strict",
  });
  return result.env;
}

/** Validate a plain key/value map (e.g. decrypted vault) without mutating process.env. */
export function validateEnvRecord(
  record: Record<string, string>,
  options?: { mode?: EnvValidationMode; profile?: "production" | "staging" },
): EnvValidationResult {
  const source: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    APP_ENV: options?.profile ?? "production",
    ...record,
  };
  return validateEnv({
    source,
    mode: options?.mode ?? "strict",
    throwOnError: false,
  });
}
