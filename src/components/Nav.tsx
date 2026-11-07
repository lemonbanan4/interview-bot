"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/prepare", label: "Prepare" },
  { href: "/setup", label: "Setup" },
  { href: "/dashboard/chat", label: "Mentor" },
  { href: "/session", label: "Live HUD" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLanding = pathname === "/";
  const isHud = pathname.startsWith("/hud");

  if (isHud) return null;

  return (
    <header
      className={`border-b border-white/10 backdrop-blur-xl ${
        isLanding ? "absolute inset-x-0 top-0 z-20 border-transparent bg-transparent" : "bg-black/20"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
            Signal
          </span>
          {!isLanding ? (
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Interview Copilot
            </span>
          ) : null}
        </Link>
        <div className="flex items-center gap-3">
          {!isLanding ? (
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((link) => {
                const active =
                  link.href === "/dashboard"
                    ? pathname === "/dashboard" ||
                      (pathname.startsWith("/dashboard/") &&
                        !pathname.startsWith("/dashboard/chat"))
                    : pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <nav className="flex items-center gap-1">
              <Link
                href="/setup"
                className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Setup
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Dashboard
              </Link>
            </nav>
          )}
          {status === "loading" ? null : session?.user ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              title={session.user.email || session.user.name || "Signed in"}
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-[var(--accent-soft)] px-3 py-1.5 text-sm text-[var(--accent)]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
