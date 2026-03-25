"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { VerificationPrompt } from "@/components/auth/verification-prompt";
import { ConnectionProgressNote } from "@/components/analytics/connection-progress-note";
import { QrGeneratorPanel } from "@/components/qr/qr-generator-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { isApiError } from "@/lib/api/client";
import { personaApi } from "@/lib/api/persona-api";
import { userApi } from "@/lib/api/user-api";
import { routes } from "@/lib/constants/routes";
import { useNetworkStatus } from "@/lib/network/use-network-status";
import { getShareInstruction } from "@/lib/persona/share-copy";
import { getShareFastSnapshot, seedMyFastShare } from "@/lib/share-fast-store";
import type { CurrentUserAnalytics } from "@/types/analytics";
import type {
  MyFastSharePayload,
  PersonaFastSharePayload,
  PersonaSummary,
} from "@/types/persona";
import type { UserProfile } from "@/types/user";

interface InstantShareExperienceProps {
  initialFastShare?: MyFastSharePayload | null;
  initialUser?: UserProfile | null;
  initialAnalytics?: CurrentUserAnalytics | null;
}

function formatBootstrapError(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }

  return "Share is unavailable right now. Try again in a moment.";
}

function avatarGradient(seed: string): string {
  const hue = ((seed.charCodeAt(0) || 68) * 73) % 360;

  return `linear-gradient(135deg, hsl(${hue} 72% 58%) 0%, hsl(${(hue + 36) % 360} 72% 42%) 100%)`;
}

function getInitials(fullName: string): string {
  const letters = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return letters || fullName.charAt(0).toUpperCase() || "D";
}

function FastQrShell({
  sharePayload,
  isRefreshing,
  error,
  onRetry,
  isVerified,
  isOnline,
}: {
  sharePayload: PersonaFastSharePayload | null;
  isRefreshing: boolean;
  error: string | null;
  onRetry: () => void;
  isVerified: boolean;
  isOnline: boolean;
}) {
  const hasCachedShare = sharePayload !== null;

  return (
    <div className="space-y-6 motion-safe:animate-[fade-in_420ms_ease-out]">
      <div className="rounded-[1.25rem] bg-foreground/[0.02] backdrop-blur-[40px] saturate-[200%] ring-[0.5px] ring-black/5 dark:bg-white/[0.03] dark:ring-white/10 shadow-sm p-4 sm:p-5 flex flex-col gap-6">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Step 1
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Ready share
          </h2>
          <p className="text-sm leading-6 text-muted">
            Keep one large QR ready to scan, even when the network needs a
            moment to catch up.
          </p>
        </div>

        {sharePayload ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-foreground/[0.03] px-3.5 py-3 shadow-inner dark:bg-white/[0.045] sm:px-4 sm:py-3.5">
            {sharePayload.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sharePayload.profilePhotoUrl}
                alt={sharePayload.fullName}
                className="h-11 w-11 rounded-xl object-cover sm:h-12 sm:w-12"
              />
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white sm:h-12 sm:w-12"
                style={{
                  background: avatarGradient(sharePayload.fullName),
                }}
              >
                {getInitials(sharePayload.fullName)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[1.1rem] font-semibold tracking-tight text-foreground">
                  {sharePayload.fullName}
                </h1>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null}
              </div>
              <p className="truncate text-sm leading-6 text-muted">
                @{sharePayload.username}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="mx-auto flex w-full flex-1 items-center justify-center">
            <div className="relative w-full rounded-3xl bg-white px-3 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] dark:bg-zinc-950 dark:ring-white/[0.04] sm:px-4 sm:py-5">
              {sharePayload ? (
                <div className="flex min-h-[26rem] items-center justify-center sm:min-h-[28rem]">
                  <QRCodeSVG
                    value={sharePayload.qrValue}
                    size={440}
                    level="H"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#050505"
                    className="relative h-auto w-full max-w-[26rem]"
                  />
                </div>
              ) : (
                <div className="flex min-h-[26rem] flex-col items-center justify-center gap-4 sm:min-h-[28rem]">
                  <div className="skeleton h-[22.5rem] w-full max-w-[22.5rem] rounded-3xl sm:h-[23.5rem] sm:max-w-[23.5rem]" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-center">
            <p className="text-base font-semibold text-foreground">
              {getShareInstruction(sharePayload?.preferredShareType)}
            </p>
            {isRefreshing && hasCachedShare ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Updating quietly
              </p>
            ) : null}
            {!isOnline ? (
              <p className="mx-auto max-w-[30ch] text-sm leading-6 text-amber-700 dark:text-amber-300">
                You are offline. Showing your last ready QR.
              </p>
            ) : null}
            {error && hasCachedShare ? (
              <p className="mx-auto max-w-[30ch] text-sm leading-6 text-amber-700 dark:text-amber-300">
                Showing your last ready QR while Dotly reconnects.
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl bg-amber-500/5 ring-1 ring-inset ring-amber-500/20 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  Share controls could not refresh
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-700/90 dark:text-amber-200/90">
                  {hasCachedShare
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
  );
}

export function InstantShareExperience({
  initialFastShare = null,
  initialUser = null,
  initialAnalytics = null,
}: InstantShareExperienceProps) {
  const isOnline = useNetworkStatus();
  const cachedSharePayload = useMemo(() => {
    const initialSharePayload =
      initialFastShare?.persona && initialFastShare.share
        ? {
            personaId: initialFastShare.persona.id,
            username: initialFastShare.persona.username,
            fullName: initialFastShare.persona.fullName,
            profilePhotoUrl: initialFastShare.persona.profilePhotoUrl,
            shareUrl: initialFastShare.share.shareUrl,
            qrValue: initialFastShare.share.qrValue,
            primaryAction: initialFastShare.share.primaryAction,
            effectiveActions: initialFastShare.share.effectiveActions,
            preferredShareType: initialFastShare.share.preferredShareType,
            hasQuickConnect:
              initialFastShare.share.preferredShareType === "instant_connect",
            quickConnectUrl:
              initialFastShare.share.preferredShareType === "instant_connect"
                ? initialFastShare.share.shareUrl
                : null,
          }
        : null;

    return initialSharePayload ?? getShareFastSnapshot().sharePayload ?? null;
  }, [initialFastShare]);
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [fastShare, setFastShare] = useState<MyFastSharePayload | null>(
    initialFastShare,
  );
  const [analytics, setAnalytics] = useState<CurrentUserAnalytics | null>(
    initialAnalytics,
  );
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
    if (!isOnline && cachedSharePayload) {
      setIsBootstrapping(false);
      return;
    }

    let isCancelled = false;

    setIsBootstrapping(true);

    const userPromise = initialUser
      ? Promise.resolve(initialUser)
      : userApi.getCurrent();
    const analyticsPromise = initialAnalytics
      ? Promise.resolve(initialAnalytics)
      : userApi.getCurrentAnalytics().catch(() => null);
    const fastSharePromise = initialFastShare
      ? Promise.resolve(initialFastShare)
      : personaApi.getMyFastShare();

    void Promise.all([
      userPromise,
      personaApi.list(),
      fastSharePromise,
      analyticsPromise,
    ])
      .then(([nextUser, nextPersonas, nextFastShare, nextAnalytics]) => {
        if (isCancelled) {
          return;
        }

        seedMyFastShare(nextFastShare);

        startTransition(() => {
          setUser(nextUser);
          setPersonas(nextPersonas);
          setFastShare(nextFastShare);
          setAnalytics(nextAnalytics);
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
  }, [
    cachedSharePayload,
    initialAnalytics,
    initialFastShare,
    initialUser,
    isOnline,
    reloadNonce,
  ]);

  const resolvedFastShare = fastShare ?? initialFastShare;
  const hasResolvedFastShare = Boolean(
    resolvedFastShare?.persona && resolvedFastShare?.share,
  );

  if (user && personas && personas.length > 0 && hasResolvedFastShare) {
    return (
      <QrGeneratorPanel
        initialFastShare={resolvedFastShare}
        analytics={analytics}
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
            {isOnline
              ? "Open one screen and hand over a large, scannable QR in seconds."
              : "You are offline and no cached QR is available yet."}
          </p>
        </div>

        <EmptyState
          title={
            isOnline
              ? "Create a profile to start sharing"
              : "No offline QR available"
          }
          description={
            isOnline
              ? "Create your first profile so you can share a live QR for meetings, events, and introductions."
              : "Reconnect once to load your ready QR, then Dotly can keep it available if the network drops."
          }
          action={
            isOnline ? (
              <Link href={routes.app.createPersona}>
                <SecondaryButton className="h-[60px] w-full active:scale-95">
                  Create profile
                </SecondaryButton>
              </Link>
            ) : (
              <SecondaryButton
                type="button"
                className="h-[60px] w-full active:scale-95"
                onClick={() => setReloadNonce((current) => current + 1)}
              >
                Retry when online
              </SecondaryButton>
            )
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
          description="Verify your email or phone to unlock QR sharing."
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

  if (
    !isBootstrapping &&
    user &&
    personas &&
    personas.length > 0 &&
    !hasResolvedFastShare
  ) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center gap-6">
        <div className="space-y-2">
          <p className="label-xs text-muted">Share</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Show your QR
          </h1>
          <p className="max-w-md text-sm leading-6 text-muted">
            Dotly could not resolve your ready share yet.
          </p>
        </div>

        <EmptyState
          title="Share unavailable"
          description="Your share card is not ready right now. Try again or review this persona's share settings."
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
    <div className="space-y-4 sm:space-y-5">
      <ConnectionProgressNote analytics={analytics} />
      <FastQrShell
        sharePayload={cachedSharePayload}
        isRefreshing={isBootstrapping}
        error={loadError}
        onRetry={() => setReloadNonce((current) => current + 1)}
        isVerified={initialUser?.security.trustBadge === "verified"}
        isOnline={isOnline}
      />
    </div>
  );
}
