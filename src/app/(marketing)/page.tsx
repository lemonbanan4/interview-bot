import Link from "next/link";
import { HudPreview } from "@/components/marketing/HudPreview";
import { PricingCheckout } from "@/components/marketing/PricingCheckout";
import { SocialProofCounters } from "@/components/marketing/SocialProofCounters";

/**
 * High-converting marketing landing — brand-first hero, HUD preview,
 * social proof, and Stripe Pro / Unlimited pricing.
 */
export default function LandingPage() {
  return (
    <div className="landing-root bg-slate-950 text-slate-100">
      <section className="landing-hero relative isolate min-h-[100svh] overflow-hidden">
        <div className="landing-hero-glow" aria-hidden />
        <div className="landing-hero-grid" aria-hidden />
        <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-6xl items-center gap-12 px-5 pb-20 pt-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="landing-fade-in font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-slate-50 sm:text-6xl md:text-7xl">
              Signal
            </p>
            <h1 className="landing-fade-in-delay mt-5 max-w-xl font-[family-name:var(--font-display)] text-3xl font-semibold leading-[1.15] tracking-tight text-slate-50 md:text-4xl">
              Invisible coaching when the interview is live.
            </h1>
            <p className="landing-fade-in-delay-2 mt-4 max-w-lg text-base leading-relaxed text-slate-400 md:text-lg">
              Mic → Deepgram → GPT-4o talking points in a stealth HUD. Desktop
              overlay stays click-through so window shares never leak your
              coach.
            </p>
            <div className="landing-fade-in-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/setup"
                className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Start free setup
              </Link>
              <Link
                href="#pricing"
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-emerald-400/40"
              >
                View pricing
              </Link>
            </div>
          </div>
          <div className="landing-fade-in-delay-2">
            <HudPreview />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/30 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SocialProofCounters />
        </div>
      </section>

      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-50 md:text-3xl">
            From prep to debrief in one loop
          </h2>
          <p className="mt-3 max-w-xl text-slate-400">
            Upload your story once. Signal coaches you before, during, and after
            the call.
          </p>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Onboard",
                body: "Resume, JD, AI persona, and the screen-share safety rule.",
                href: "/setup",
              },
              {
                step: "02",
                title: "Go live",
                body: "Stealth HUD streams STT → concise talking points. Overlay stays click-through.",
                href: "/session",
              },
              {
                step: "03",
                title: "Review",
                body: "Scorecards for accuracy, clarity, and pacing — plus Markdown export.",
                href: "/dashboard",
              },
            ].map((item) => (
              <li key={item.step} className="space-y-3">
                <p className="font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] text-emerald-400">
                  {item.step}
                </p>
                <h3 className="font-[family-name:var(--font-display)] text-xl text-slate-50">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {item.body}
                </p>
                <Link
                  href={item.href}
                  className="inline-block text-sm text-emerald-400 hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-white/10 bg-gradient-to-b from-slate-950 to-black/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-12 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-50 md:text-3xl">
              Simple pricing for serious interviews
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Pro at $29/mo or Unlimited at $79/mo — checkout runs through Stripe
              with credits synced by webhook.
            </p>
          </div>
          <PricingCheckout />
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5">
          <p className="font-[family-name:var(--font-display)] text-lg text-slate-50">
            Signal
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <Link href="/dashboard/chat" className="hover:text-emerald-400">
              Mentor
            </Link>
            <Link href="/prepare" className="hover:text-emerald-400">
              Prepare
            </Link>
            <Link href="/login" className="hover:text-emerald-400">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
