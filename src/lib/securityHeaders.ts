/**
 * Production security headers + CSP helpers.
 * Applied from next.config and reinforced in the Next.js 16 proxy (`src/proxy.ts`).
 *
 * NOTE: Next.js 16 uses `proxy.ts` — do not add `middleware.ts`.
 */

const isDev = process.env.NODE_ENV !== "production";

/** HSTS: 1 year, include subdomains, preload-ready. */
export const HSTS_VALUE = "max-age=31536000; includeSubDomains; preload";

export const REFERRER_POLICY = "strict-origin-when-cross-origin";

/**
 * Microphone allowed for same-origin interview / practice recording UI.
 * Camera + geolocation locked off; payment allowed for Stripe Elements.
 */
export const PERMISSIONS_POLICY = [
  "camera=()",
  "geolocation=()",
  "microphone=(self)",
  "display-capture=()",
  "payment=(self)",
  "usb=()",
  "interest-cohort=()",
  "browsing-topics=()",
].join(", ");

/** Headers every response must carry (verified by `__tests__/security.test.ts`). */
export const REQUIRED_SECURITY_HEADER_NAMES = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
] as const;

export type SecurityHeaderOptions = {
  /** Per-request CSP nonce (base64). Enables strict-dynamic script policy. */
  nonce?: string;
  /** Skip HSTS on plaintext local/dev responses. Default: production only. */
  includeHsts?: boolean;
};

function joinSources(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/** Baseline CSP: App Router + Stripe + Sentry + Deepgram + OpenAI + Google OAuth. */
export function buildContentSecurityPolicy(nonce?: string): string {
  const scriptNonce = nonce ? `'nonce-${nonce}'` : "";
  const scriptSrc = joinSources(
    "'self'",
    scriptNonce,
    // With a nonce, prefer strict-dynamic so only nonce-trusted scripts pull deps.
    // Without a nonce (static next.config headers), keep unsafe-inline for hydration.
    nonce ? "'strict-dynamic'" : "'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    "https://js.stripe.com",
    "https://*.stripe.com",
    "https://*.sentry-cdn.com",
  );

  const styleSrc = joinSources(
    "'self'",
    "'unsafe-inline'", // next/font + CSS-in-JS style attributes
    nonce ? `'nonce-${nonce}'` : "",
  );

  const imgSrc = joinSources(
    "'self'",
    "data:",
    "blob:",
    "https://*.stripe.com",
    "https://*.openai.com",
    "https://*.deepgram.com",
    "https://*.sentry.io",
    "https://*.googleusercontent.com",
    "https://lh3.googleusercontent.com",
  );

  const connectSrc = joinSources(
    "'self'",
    "https://api.stripe.com",
    "https://*.stripe.com",
    "https://api.openai.com",
    "https://*.openai.com",
    "https://api.deepgram.com",
    "https://*.deepgram.com",
    "wss://api.deepgram.com",
    "wss://*.deepgram.com",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://*.ingest.de.sentry.io",
    "https://accounts.google.com",
    "https://*.googleapis.com",
    isDev ? "ws://localhost:*" : "",
    isDev ? "http://localhost:*" : "",
    isDev ? "ws://127.0.0.1:*" : "",
    isDev ? "http://127.0.0.1:*" : "",
  );

  const frameSrc = joinSources(
    "'self'",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
    "https://checkout.stripe.com",
  );

  const formAction = joinSources(
    "'self'",
    "https://checkout.stripe.com",
    "https://accounts.google.com",
  );

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "media-src 'self' blob:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action ${formAction}`,
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

/** Parse a CSP string into directive → source map (for tests / debugging). */
export function parseCspDirectives(csp: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const space = trimmed.indexOf(" ");
    if (space < 0) {
      out[trimmed] = "";
      continue;
    }
    out[trimmed.slice(0, space)] = trimmed.slice(space + 1).trim();
  }
  return out;
}

/** Flat header list for `next.config.ts` `headers()`. */
export function staticSecurityHeaders(): Array<{
  key: string;
  value: string;
}> {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
    {
      key: "Strict-Transport-Security",
      value: HSTS_VALUE,
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: REFERRER_POLICY },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin-allow-popups",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "same-site",
    },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];
}

/**
 * Apply enterprise security headers onto an outgoing response (proxy / tests).
 * Prefer a per-request nonce so inline Next bootstraps can use strict-dynamic.
 */
export function applySecurityHeaders(
  headers: Headers,
  options: SecurityHeaderOptions = {},
): void {
  const includeHsts =
    options.includeHsts ?? process.env.NODE_ENV === "production";

  headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(options.nonce),
  );
  if (includeHsts) {
    headers.set("Strict-Transport-Security", HSTS_VALUE);
  }
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", REFERRER_POLICY);
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-DNS-Prefetch-Control", "on");
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
}

/** Snapshot used by automated verification tests. */
export function securityHeaderSnapshot(
  options: SecurityHeaderOptions = {},
): Record<string, string> {
  const headers = new Headers();
  applySecurityHeaders(headers, {
    ...options,
    includeHsts: options.includeHsts ?? true,
  });
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
