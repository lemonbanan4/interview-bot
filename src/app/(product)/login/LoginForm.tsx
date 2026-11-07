import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { GlassPanel } from "@/components/ui/GlassPanel";

export async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/dashboard";

  if (session?.user) {
    redirect(callbackUrl);
  }

  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  const emailEnabled = Boolean(process.env.EMAIL_SERVER);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Sign in
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
          Welcome to Signal
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Authenticate to access live sessions and your interview dashboard.
        </p>
      </div>

      <GlassPanel className="space-y-4 p-6">
        {params.error ? (
          <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            Sign-in failed ({params.error}). Try again.
          </p>
        ) : null}

        {googleEnabled ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#041512] transition hover:brightness-110"
            >
              Continue with Google
            </button>
          </form>
        ) : null}

        {emailEnabled ? (
          <form
            action={async (formData) => {
              "use server";
              const email = String(formData.get("email") || "").trim();
              if (!email) return;
              await signIn("nodemailer", {
                email,
                redirectTo: callbackUrl,
              });
            }}
            className="space-y-3 border-t border-white/10 pt-4"
          >
            <label className="block space-y-1.5 text-sm">
              <span className="text-[var(--muted)]">Email magic link</span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50"
            >
              Email me a sign-in link
            </button>
          </form>
        ) : null}

        {!googleEnabled && !emailEnabled ? (
          <p className="text-sm text-[var(--muted)]">
            Auth providers are not configured. Set{" "}
            <code className="text-[var(--accent)]">AUTH_GOOGLE_ID</code> /{" "}
            <code className="text-[var(--accent)]">AUTH_GOOGLE_SECRET</code>{" "}
            and/or <code className="text-[var(--accent)]">EMAIL_SERVER</code> in{" "}
            <code>.env.local</code>.
          </p>
        ) : null}
      </GlassPanel>
    </div>
  );
}
