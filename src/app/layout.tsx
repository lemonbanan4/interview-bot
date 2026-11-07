import type { Metadata } from "next";
import { Suspense } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Signal — AI Interview Copilot",
  description:
    "Real-time stealth coaching for interviews. Live STT, GPT-4o talking points, post-interview scorecards, and a desktop overlay that stays invisible in screen shares.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <Suspense
            fallback={
              <header className="border-b border-[var(--line)] bg-[var(--panel)]/80">
                <div className="mx-auto h-14 max-w-6xl px-5" />
              </header>
            }
          >
            <Nav />
          </Suspense>
          <main className="flex w-full flex-1 flex-col">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
