import { Suspense } from "react";
import { SessionDetail } from "./SessionDetail";

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="skeleton h-80 rounded-2xl" />}>
      <SessionDetail params={params} />
    </Suspense>
  );
}
