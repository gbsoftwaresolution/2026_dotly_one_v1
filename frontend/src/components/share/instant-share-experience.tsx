"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { QrGeneratorPanel } from "@/components/qr/qr-generator-panel";
import { VerificationPrompt } from "@/components/auth/verification-prompt";
import { EmptyState } from "@/components/shared/empty-state";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { isApiError } from "@/lib/api/client";
import { personaApi } from "@/lib/api/persona-api";
import { userApi } from "@/lib/api/user-api";
import { routes } from "@/lib/constants/routes";
import { getShareFastSnapshot, seedMyFastShare } from "@/lib/share-fast-store";
import type { MyFastSharePayload, PersonaSummary } from "@/types/persona";
import type { UserProfile } from "@/types/user";

interface InstantShareExperienceProps {
  initialFastShare?: MyFastSharePayload | null;
  initialUser?: UserProfile | null;
}

function formatBootstrapError(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  return "Share is unavailable right now. Try again in a moment.";
}

function FastQrShell({
  sharePayload,
  isRefreshing,
  error,
  onRetry,
}: {
  sharePayload: NonNullable<MyFastSharePayload["sharePayload"]> | null;
  isRefreshing: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const hasCachedShare = sharePayload !== null;

  return (
    <section className="relative isolate overflow-hidden rounded-[2.5rem] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.98)_100%)] p-4 shadow-[0_36px_120px_rgba(15,23,42,0.12)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(18,18,20,0.96)_0%,rgba(8,8,9,0.98)_100%)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
        <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-brandRose/12 blur-3xl dark:bg-brandCyan/10" />
        <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-brandViolet/12 blur-3xl dark:bg-brandCyan/8" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100dvh-3rem)] flex-col gap-5 sm:min-h-[calc(100dvh-4rem)]">
        <div className="space-y-2">
          <p className="label-xs text-muted">Share</p>
          <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">
            Show your QR
          </h1>
          <p className="max-w-[30rem] text-sm leading-6 text-muted">
            {hasCachedShare
              ? "Your last ready profile QR is visible immediately while Dotly refreshes controls in the background."
              : "Loading your share controls now."}
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="mx-auto flex w-full max-w-[26rem] flex-1 items-center justify-center">
            <div className="relative w-full rounded-[2.25rem] border border-black/[0.08] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(15,23,42,0.10)] dark:border-white/[0.08] dark:bg-zinc-950 sm:px-7 sm:py-7">
              <div className="pointer-events-none absolute inset-x-10 top-1/2 h-28 -translate-y-1/2 rounded-full bg-brandRose/10 blur-3xl dark:bg-brandCyan/10" />

              {sharePayload ? (
                <div className="flex min-h-[22rem] items-center justify-center sm:min-h-[24rem]">
                  <QRCodeSVG
                    value={sharePayload.qrValue}
                    size={320}
                    level="H"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#050505"
                    className="relative h-auto w-full max-w-[20rem]"
                  />
                </div>
              ) : (
                <div className="flex min-h-[22rem] flex-col items-center justify-center gap-4 sm:min-h-[24rem]">
                  <div className="skeleton h-[19rem] w-full max-w-[19rem] rounded-[1.8rem] sm:h-[20rem] sm:max-w-[20rem]" />
                  <div className="skeleton h-3 w-40 rounded-full" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-center">
            <p className="text-base font-semibold text-foreground">
              {sharePayload ? "Scan to open my profile" : "Preparing your share card"}
            </p>
            <p className="mx-auto max-w-[34ch] text-sm leading-6 text-muted">
              {sharePayload
                ? "Keep this screen open while the full share controls finish loading."
                : "Dotly is loading your personas and trust-aware sharing controls."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {sharePayload ? (
            <div className="rounded-[1.75rem] border border-black/[0.06] bg-white/78 px-4 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] dark:border-white/[0.08] dark:bg-white/[0.045] sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-foreground">
                    {sharePayload.fullName}
                  </p>
                  <p className="truncate text-sm text-muted">@{sharePayload.username}</p>
                </div>

                {isRefreshing ? (
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                    Refreshing
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[1.75rem] border border-amber-500/20 bg-amber-500/5 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Share controls could not refresh
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-700/90 dark:text-amber-200/90">
                    {sharePayload
                      ? "Showing your last ready QR while the network catches up."
                      : error}
                  </p>
                </div>

                <SecondaryButton type="button" size="sm" onClick={onRetry}>
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </span>
                </SecondaryButton>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function InstantShareExperience({
  initialFastShare = null,
  initialUser = null,
}: InstantShareExperienceProps) {
  const cachedSharePayload = useMemo(() => {
    return (
      initialFastShare?.sharePayload ?? getShareFastSnapshot().sharePayload ?? null
    );
  }, [initialFastShare]);
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [personas, setPersonas] = useState<PersonaSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    if (initialFastShare) {
      seedMyFastShare(initialFastShare);
    }
  }, [initialFastShare]);

  useEffect(() => {
    let isCancelled = false;

    setIsBootstrapping(true);

    const userPromise = initialUser ? Promise.resolve(initialUser) : userApi.getCurrent();

    void Promise.all([userPromise, personaApi.list()])
      .then(([nextUser, nextPersonas]) => {
        if (isCancelled) {
          return;
        }

        startTransition(() => {
          setUser(nextUser);
          setPersonas(nextPersonas);
          setLoadError(null);
          setIsBootstrapping(false);
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        startTransition(() => {
          setLoadError(formatBootstrapError(error));
          setIsBootstrapping(false);
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [initialUser, reloadNonce]);

  if (user && personas && personas.length > 0) {
    return (
      <QrGeneratorPanel
        initialFastShare={initialFastShare}
        personas={personas}
        user={user}
      />
    );
  }

  if (!isBootstrapping && user && personas && personas.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center gap-6">
        <div className="space-y-2">
          <p className="label-xs text-muted">Share</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Show your QR
          </h1>
          <p className="max-w-md text-sm leading-6 text-muted">
            Open one screen and hand over a large, scannable QR in seconds.
          </p>
        </div>

        <EmptyState
          title="Create your Dotly identity to start sharing"
          description="Build your first persona so Dotly can generate a live share card for meetings, events, and quick face-to-face handoffs."
          action={
            <Link href={routes.app.createPersona}>
              <SecondaryButton className="h-[60px] w-full active:scale-95">
                Create persona
              </SecondaryButton>
            </Link>
          }
        />
      </div>
    );
  }

  if (!isBootstrapping && loadError && user && !cachedSharePayload) {
    const profileQrRequirement = user.security.requirements.find(
      (requirement) => requirement.key === "create_profile_qr",
    );
    const quickConnectRequirement = user.security.requirements.find(
      (requirement) => requirement.key === "create_quick_connect_qr",
    );
    const shareLocked =
      profileQrRequirement?.unlocked === false &&
      quickConnectRequirement?.unlocked === false;

    if (shareLocked) {
      return (
        <VerificationPrompt
          email={user.email}
          title="QR sharing is waiting on verification"
          description="Verify your email or mobile factor to unlock a live share card for in-person introductions."
          compact
        />
      );
    }

    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center gap-6">
        <div className="space-y-2">
          <p className="label-xs text-muted">Share</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Show your QR
          </h1>
          <p className="max-w-md text-sm leading-6 text-muted">
            Open one screen and hand over a large, scannable QR in seconds.
          </p>
        </div>

        <EmptyState
          title="Share unavailable"
          description={loadError}
          action={
            <SecondaryButton
              type="button"
              className="h-[60px] w-full active:scale-95"
              onClick={() => setReloadNonce((current) => current + 1)}
            >
              Try again
            </SecondaryButton>
          }
        />
      </div>
    );
  }

  return (
    <FastQrShell
      sharePayload={cachedSharePayload}
      isRefreshing={isBootstrapping}
      error={loadError}
      onRetry={() => setReloadNonce((current) => current + 1)}
    />
  );
}