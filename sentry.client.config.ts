import * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent, TransactionEvent } from "@sentry/core";
import {
  resolveReplaySampleRates,
  resolveSentryEnvironment,
  resolveSentryRelease,
  resolveTraceSampleRates,
} from "@/lib/sentry/env";
import { scrubBreadcrumb, scrubSentryEvent } from "@/lib/sentry/privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const environment = resolveSentryEnvironment();
const release = resolveSentryRelease();
const tracesSampleRate = resolveTraceSampleRates("client");
const replay = resolveReplaySampleRates();

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment,
  release,

  tracesSampleRate,
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/app\.interviewcopilot\.app/,
    /^https:\/\/.*\.interviewcopilot\.app/,
  ],

  replaysSessionSampleRate: replay.session,
  replaysOnErrorSampleRate: replay.onError,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      networkDetailAllowUrls: [],
      networkCaptureBodies: false,
      networkRequestHeaders: [],
      networkResponseHeaders: [],
    }),
    Sentry.browserTracingIntegration(),
    Sentry.feedbackIntegration({
      colorScheme: "light",
      showBranding: false,
      autoInject: false,
    }),
  ],

  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection captured",
    /^AbortError/,
    /Loading chunk [\d]+ failed/,
  ],

  initialScope: {
    tags: {
      runtime: "browser",
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
