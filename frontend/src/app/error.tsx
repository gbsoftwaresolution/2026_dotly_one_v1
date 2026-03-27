"use client";

import { AppErrorScreen } from "@/components/observability/app-error-screen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string; componentStack?: string };
  reset: () => void;
}) {
  return <AppErrorScreen error={error} reset={reset} />;
}
