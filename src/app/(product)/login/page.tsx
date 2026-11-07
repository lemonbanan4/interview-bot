import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const instant = false;

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="skeleton mx-auto h-64 max-w-md rounded-2xl" />}
    >
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}
