"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/shared/card";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { routes } from "@/lib/constants/routes";
import {
  createErrorReferenceId,
  reportClientRuntimeError,
} from "@/lib/observability/runtime-error";

interface AppErrorScreenProps {
  error: Error & { digest?: string; componentStack?: string };
  reset: () => void;
}

export function AppErrorScreen({ error, reset }: AppErrorScreenProps) {
  const [referenceId] = useState(
    () => error.digest || createErrorReferenceId(),
  );

  useEffect(() => {
    void reportClientRuntimeError({
      source: "client_error_boundary",
      error,
      referenceId,
      digest: error.digest,
      componentStack: error.componentStack,
    });
  }, [error, referenceId]);

  return (
    <main className="mx-auto flex min-h-screen max-w-app items-center px-4 py-6">
      <Card className="w-full space-y-5 text-center" elevated>
        <div className="space-y-3">
          <p className="label-xs uppercase">Runtime recovery</p>
          <h1 className="text-2xl font-semibold text-foreground">
            Something went wrong in Dotly
          </h1>
          <p className="text-sm leading-6 text-muted">
            The issue has been captured for follow-up. Try the action again or
            return to a stable screen.
          </p>
        </div>

        <div className="rounded-3xl border border-black/5 bg-black/[0.03] px-4 py-3 text-left dark:border-white/10 dark:bg-white/[0.03]">
          <p className="label-xs uppercase">Reference</p>
          <p className="mt-2 break-all font-mono text-xs text-foreground">
            {referenceId}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <PrimaryButton type="button" onClick={reset}>
            Try again
          </PrimaryButton>
          <Link href={routes.app.home}>
            <SecondaryButton type="button">Open dashboard</SecondaryButton>
          </Link>
        </div>
      </Card>
    </main>
  );
}
