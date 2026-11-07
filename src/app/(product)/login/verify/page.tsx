import Link from "next/link";
import { GlassPanel } from "@/components/ui/GlassPanel";

export const instant = false;

export default function VerifyRequestPage() {
  return (
    <div className="mx-auto max-w-md pt-10">
      <GlassPanel className="space-y-3 p-8 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Check your email
        </h1>
        <p className="text-sm text-[var(--muted)]">
          A sign-in link is on the way. Open it on this device to finish
          authenticating.
        </p>
        <Link href="/login" className="inline-block text-sm text-[var(--accent)]">
          Back to sign in
        </Link>
      </GlassPanel>
    </div>
  );
}
