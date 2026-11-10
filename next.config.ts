import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { staticSecurityHeaders } from "./src/lib/securityHeaders";
import { validateEnv } from "./src/lib/env";

// Build-time env gate — never logs secret values, only missing key paths.
// Strict on Railway/Vercel deploy platforms; warn locally so `next build` works
// without a full production secret set. Override with ENV_VALIDATION=strict|off.
const onDeployPlatform = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PROJECT_ID ||
  process.env.VERCEL ||
  process.env.FORCE_ENV_VALIDATION === "1",
);
validateEnv({
  mode: process.env.ENV_VALIDATION
    ? undefined
    : onDeployPlatform
      ? "strict"
      : "warn",
});

const nextConfig: NextConfig = {
  // Minimal production server for Docker / Railway (`.next/standalone`).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Node redis / native clients must stay off the browser graph.
  serverExternalPackages: ["redis", "@redis/client"],
  // swagger-ui-react ships browser-oriented ESM that needs bundling.
  transpilePackages: ["swagger-ui-react"],
  // Keep Prisma engines inside the standalone trace for migrate + runtime.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./prisma/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders(),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source map upload is skipped unless SENTRY_AUTH_TOKEN is set.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
