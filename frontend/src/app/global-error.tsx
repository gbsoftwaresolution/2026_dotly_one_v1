"use client";

import { AppErrorScreen } from "@/components/observability/app-error-screen";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string; componentStack?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground overflow-x-hidden">
        <AppErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
