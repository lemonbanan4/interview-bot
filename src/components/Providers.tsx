"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTrayNavigation } from "@/hooks/useTrayNavigation";

function TrayNavigationBridge() {
  useTrayNavigation();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TrayNavigationBridge />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
