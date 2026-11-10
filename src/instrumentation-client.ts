/**
 * Client instrumentation entry (Next.js + Sentry).
 * Loads the shared browser Sentry init and exports App Router transition hooks.
 */
import "../sentry.client.config";
import { captureRouterTransitionStart } from "@sentry/nextjs";

/** Next.js App Router hook — records client navigations as Sentry spans. */
export const onRouterTransitionStart = captureRouterTransitionStart;
