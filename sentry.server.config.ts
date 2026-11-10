import * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent, TransactionEvent } from "@sentry/core";
import {
  resolveSentryEnvironment,
  resolveSentryRelease,
  resolveTraceSampleRates,
} from "@/lib/sentry/env";
import { scrubBreadcrumb, scrubSentryEvent } from "@/lib/sentry/privacy";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = resolveSentryEnvironment();
const release = resolveSentryRelease();
const tracesSampleRate = resolveTraceSampleRates("server");

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment,
  release,

  tracesSampleRate,
  includeLocalVariables: environment !== "production",

  initialScope: {
    tags: {
      runtime: "nodejs",
      "deploy.environment": environment,
      ...(release ? { "git.release": release } : {}),
    },
  },

  beforeBreadcrumb(breadcrumb) {
    return scrubBreadcrumb(
      breadcrumb as unknown as Record<string, unknown>,
    ) as Breadcrumb;
  },

  beforeSend(event) {
    return scrubSentryEvent(
      event as unknown as Record<string, unknown>,
    ) as unknown as ErrorEvent;
  },

  beforeSendTransaction(event) {
    return scrubSentryEvent(
      event as unknown as Record<string, unknown>,
    ) as unknown as TransactionEvent;
  },
});
