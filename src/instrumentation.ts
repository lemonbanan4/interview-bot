import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation — loads Sentry for Node and Edge runtimes.
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast on missing production secrets (Zod). Skipped when
    // SKIP_ENV_VALIDATION=1 or ENV_VALIDATION=off (tests / local).
    const { assertEnv } = await import("@/lib/env");
    assertEnv();
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
