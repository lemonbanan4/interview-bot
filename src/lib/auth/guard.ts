import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { localizePath } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { RAW_PATH_HEADER } from "@/lib/auth/constants";

export type AuthenticatedSession = NonNullable<
  Awaited<ReturnType<typeof auth>>
> & {
  user: {
    id: string;
    role?: string;
    accountStatus?: string;
    plan?: string;
    subscriptionStatus?: string;
  };
};

type RequireAuthOptions = {
  /** Used when the proxy did not inject the current path header. */
  fallbackPath?: string;
};

/**
 * Server-side session gate for layouts / pages.
 * Redirects to `/{locale}/login?callbackUrl=…` so post-auth returns to the
 * intended destination (locale + deep link preserved).
 */
export async function requireAuthenticatedUser(
  options: RequireAuthOptions = {},
): Promise<AuthenticatedSession> {
  const session = await auth();
  const locale = await getRequestLocale();
  const h = await headers();
  const destination =
    h.get(RAW_PATH_HEADER)?.trim() ||
    options.fallbackPath?.trim() ||
    "/dashboard";

  if (!session?.user?.id) {
    const loginPath = localizePath("/login", locale);
    redirect(`${loginPath}?callbackUrl=${encodeURIComponent(destination)}`);
  }

  const status = session.user.accountStatus || "active";
  if (status === "banned" || status === "suspended") {
    const loginPath = localizePath("/login", locale);
    redirect(`${loginPath}?error=${encodeURIComponent("account_disabled")}`);
  }

  return session as unknown as AuthenticatedSession;
}
