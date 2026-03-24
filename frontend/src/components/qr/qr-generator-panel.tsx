"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Copy, RefreshCw, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { isApiError } from "@/lib/api/client";
import { personaApi } from "@/lib/api/persona-api";
import { routes } from "@/lib/constants/routes";
import { resolvePreferredPersonaId } from "@/lib/persona/default-persona";
import { getShareInstruction } from "@/lib/persona/share-copy";
import { useNetworkStatus } from "@/lib/network/use-network-status";
import {
  getPersonaFastShare,
  getShareFastSnapshot,
  seedMyFastShare,
  upsertPersonaFastShare,
} from "@/lib/share-fast-store";
import { cn } from "@/lib/utils/cn";
import type {
  MyFastSharePayload,
  PersonaFastSharePayload,
  PersonaSummary,
  QrTokenSummary,
} from "@/types/persona";
import type { UserProfile } from "@/types/user";

import { VerificationPrompt } from "../auth/verification-prompt";
import { ConnectionProgressNote } from "../analytics/connection-progress-note";

interface QrGeneratorPanelProps {
  initialFastShare?: MyFastSharePayload | null;
  analytics?: import("@/types/analytics").CurrentUserAnalytics | null;
  personas: PersonaSummary[];
  user: UserProfile;
}

type GeneratedQr = QrTokenSummary;
type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

function toInitialSharePayload(
  value: MyFastSharePayload | null,
): PersonaFastSharePayload | null {
  if (value?.persona === null || value?.share === null || value === null) {
    return null;
  }

  return {
    personaId: value.persona.id,
    username: value.persona.username,
    fullName: value.persona.fullName,
    profilePhotoUrl: value.persona.profilePhotoUrl,
    shareUrl: value.share.shareUrl,
    qrValue: value.share.qrValue,
    primaryAction: value.share.primaryAction,
    effectiveActions: value.share.effectiveActions,
    preferredShareType: value.share.preferredShareType,
    hasQuickConnect: value.share.preferredShareType === "instant_connect",
    quickConnectUrl:
      value.share.preferredShareType === "instant_connect"
        ? value.share.shareUrl
        : null,
  };
}

function toShareQrSummary(
  sharePayload: PersonaFastSharePayload,
): QrTokenSummary {
  return {
    id: sharePayload.personaId,
    code: sharePayload.username,
    type:
      sharePayload.preferredShareType === "instant_connect"
        ? "quick_connect"
        : "profile",
    url: sharePayload.qrValue,
  };
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

export function QrGeneratorPanel({
  initialFastShare = null,
  analytics = null,
  personas,
  user,
}: QrGeneratorPanelProps) {
  const isOnline = useNetworkStatus();
  const router = useRouter();
  const shareFastSnapshot = getShareFastSnapshot();
  const initialSelectionId =
    initialFastShare?.persona?.id ?? shareFastSnapshot.selectedPersonaId;
  const initialPersonaId = resolvePreferredPersonaId(
    personas,
    initialSelectionId,
  );
  const initialSharePayload =
    toInitialSharePayload(initialFastShare) ??
    (initialPersonaId ? getPersonaFastShare(initialPersonaId) : null);
  const initialShareQr = initialSharePayload
    ? toShareQrSummary(initialSharePayload)
    : null;
  const [selectedPersonaId, setSelectedPersonaId] = useState(initialPersonaId);
  const initialCacheKey =
    initialPersonaId && initialShareQr ? initialPersonaId : "";
  const [generatedQr, setGeneratedQr] = useState<GeneratedQr | null>(
    initialShareQr,
  );
  const [generatedQrKey, setGeneratedQrKey] = useState(initialCacheKey);
  const [sharePayload, setSharePayload] =
    useState<PersonaFastSharePayload | null>(initialSharePayload);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const cacheRef = useRef(
    new Map<string, GeneratedQr>(
      initialCacheKey && initialShareQr
        ? [[initialCacheKey, initialShareQr]]
        : [],
    ),
  );
  const latestRequestRef = useRef(0);
  const prefetchedPersonaIdsRef = useRef(new Set<string>());

  const selectedPersona =
    personas.find((persona) => persona.id === selectedPersonaId) ?? null;

  const canGenerateProfileQr = hasUnlockedTrustRequirement(
    user,
    "create_profile_qr",
  );
  const canGenerateQuickConnectQr = hasUnlockedTrustRequirement(
    user,
    "create_quick_connect_qr",
  );
  const shareLocked = !canGenerateProfileQr && !canGenerateQuickConnectQr;
  const cacheKey = selectedPersonaId;
  const identityLine = [selectedPersona?.jobTitle, selectedPersona?.companyName]
    .filter(Boolean)
    .join(" at ");
  const identityMetaLine = [identityLine, selectedPersona?.username]
    .filter(Boolean)
    .map((value, index) => (index === 1 ? `@${value}` : value))
    .join(" • ");
  const isVerified = user.security.trustBadge === "verified";
  const shareTitle = selectedPersona
    ? `${selectedPersona.fullName} on Dotly`
    : "Dotly";
  const shareText = selectedPersona
    ? sharePayload?.preferredShareType === "instant_connect"
      ? `Connect with ${selectedPersona.fullName} on Dotly.`
      : `Open ${selectedPersona.fullName}'s profile on Dotly.`
    : "Open this Dotly profile.";

  useEffect(() => {
    if (initialFastShare) {
      seedMyFastShare(initialFastShare);
    }
  }, [initialFastShare]);

  useEffect(() => {
    if (!selectedPersonaId || shareLocked) {
      setGeneratedQr(null);
      setSharePayload(null);
      setIsLoadingQr(false);
      setError(null);
      return;
    }

    if (!isOnline && (getPersonaFastShare(selectedPersonaId) || generatedQr)) {
      setIsLoadingQr(false);
      setError(null);
      return;
    }

    setFeedback(null);
    setError(null);

    const cachedQr = cacheRef.current.get(cacheKey);
    if (cachedQr) {
      setGeneratedQr(cachedQr);
      setGeneratedQrKey(cacheKey);
      setSharePayload(getPersonaFastShare(selectedPersonaId));
      setIsLoadingQr(false);
      return;
    }

    const cachedSharePayload = getPersonaFastShare(selectedPersonaId);

    if (cachedSharePayload) {
      const nextQr = toShareQrSummary(cachedSharePayload);
      cacheRef.current.set(cacheKey, nextQr);
      setGeneratedQr(nextQr);
      setGeneratedQrKey(cacheKey);
      setSharePayload(cachedSharePayload);
      setIsLoadingQr(false);
      return;
    }

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    if (generatedQrKey !== cacheKey) {
      setGeneratedQr(null);
    }
    setIsLoadingQr(true);

    void (async () => {
      try {
        const nextSharePayload =
          await personaApi.getFastShare(selectedPersonaId);
        const nextQr = toShareQrSummary(nextSharePayload);

        upsertPersonaFastShare(nextSharePayload, { selected: true });

        if (latestRequestRef.current !== requestId) {
          return;
        }

        cacheRef.current.set(cacheKey, nextQr);
        setGeneratedQr(nextQr);
        setGeneratedQrKey(cacheKey);
        setSharePayload(nextSharePayload);
      } catch (submissionError) {
        if (isApiError(submissionError) && submissionError.status === 401) {
          router.replace(
            `${routes.public.login}?next=${routes.app.qr}&reason=expired`,
          );
          return;
        }

        if (latestRequestRef.current !== requestId) {
          return;
        }

        if (generatedQrKey !== cacheKey) {
          setGeneratedQr(null);
        }
        setError(
          isApiError(submissionError)
            ? submissionError.message
            : "Share is unavailable right now. Try again in a moment.",
        );
      } finally {
        if (latestRequestRef.current === requestId) {
          setIsLoadingQr(false);
        }
      }
    })();
  }, [
    cacheKey,
    generatedQrKey,
    isOnline,
    refreshNonce,
    router,
    shareLocked,
    selectedPersonaId,
  ]);

  useEffect(() => {
    if (shareLocked || personas.length < 2) {
      return;
    }

    let isCancelled = false;

    const personaIdsToPrefetch = personas
      .map((persona) => persona.id)
      .filter(
        (personaId) =>
          personaId !== selectedPersonaId &&
          !prefetchedPersonaIdsRef.current.has(personaId) &&
          !getPersonaFastShare(personaId),
      );

    if (!personaIdsToPrefetch.length) {
      return;
    }

    for (const personaId of personaIdsToPrefetch) {
      prefetchedPersonaIdsRef.current.add(personaId);
    }

    void Promise.allSettled(
      personaIdsToPrefetch.map(async (personaId) => {
        const nextSharePayload = await personaApi.getFastShare(personaId);

        if (isCancelled) {
          return;
        }

        cacheRef.current.set(personaId, toShareQrSummary(nextSharePayload));
        upsertPersonaFastShare(nextSharePayload);
      }),
    );

    return () => {
      isCancelled = true;
    };
  }, [personas, selectedPersonaId, shareLocked]);

  async function copyCurrentLink(successMessage: string) {
    if (!generatedQr) {
      setFeedback({
        tone: "error",
        message: "Share link unavailable right now.",
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(generatedQr.url);
      setFeedback(null);
      showToast(successMessage);
      return true;
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not copy the share link right now.",
      });
      return false;
    }
  }

  async function handleShare() {
    if (!generatedQr) {
      setFeedback({
        tone: "error",
        message: "Share link unavailable right now.",
      });
      return;
    }

    if (typeof navigator.share !== "function") {
      await copyCurrentLink("Link copied");
      return;
    }

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: generatedQr.url,
      });
      setFeedback(null);
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      ) {
        return;
      }

      await copyCurrentLink("Link copied");
    }
  }

  function handleRefresh() {
    if (!cacheKey) {
      return;
    }

    cacheRef.current.delete(cacheKey);
    setRefreshNonce((value) => value + 1);
  }

  return (
    <section className="relative isolate overflow-hidden rounded-[2.9rem] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(247,249,252,0.99)_100%)] p-3 shadow-[0_36px_120px_rgba(15,23,42,0.12)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(18,18,20,0.96)_0%,rgba(8,8,9,0.98)_100%)] sm:p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.9rem]">
        <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-brandRose/12 blur-3xl dark:bg-brandCyan/10" />
        <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-brandViolet/12 blur-3xl dark:bg-brandCyan/8" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100dvh-0.75rem)] flex-col gap-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:min-h-[calc(100dvh-1rem)] sm:gap-4">
        <div className="flex items-start gap-3">
          {selectedPersona ? (
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.8rem] border border-black/[0.06] bg-white/82 px-3.5 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:border-white/[0.08] dark:bg-white/[0.045] sm:px-4 sm:py-3.5">
              {selectedPersona.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPersona.profilePhotoUrl}
                  alt={selectedPersona.fullName}
                  className="h-11 w-11 rounded-[1rem] object-cover sm:h-12 sm:w-12"
                />
              ) : (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] text-sm font-semibold text-white sm:h-12 sm:w-12"
                  style={{
                    background: avatarGradient(selectedPersona.fullName),
                  }}
                >
                  {getInitials(selectedPersona.fullName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[1.1rem] font-semibold tracking-tight text-foreground">
                    {selectedPersona.fullName}
                  </h1>
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>

                <p className="truncate text-sm leading-6 text-muted">
                  {identityMetaLine}
                </p>
              </div>
            </div>
          ) : null}

          {personas.length > 1 ? (
            <Link href={routes.app.personas} className="shrink-0">
              <SecondaryButton
                type="button"
                size="sm"
                className="h-11 rounded-[1.2rem] px-4 sm:h-12"
              >
                Switch Dotly
              </SecondaryButton>
            </Link>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4">
          <ConnectionProgressNote
            analytics={analytics}
            className="mx-auto w-full max-w-md"
          />

          <div className="mx-auto flex w-full flex-1 items-center justify-center">
            {shareLocked ? (
              <VerificationPrompt
                email={user.email}
                title="QR sharing is waiting on verification"
                description="Verify your email or phone to unlock QR sharing."
                compact
                className="w-full"
              />
            ) : error && !generatedQr ? (
              <div className="flex min-h-[24rem] w-full flex-col items-center justify-center rounded-[2.25rem] border border-rose-500/20 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:bg-zinc-950">
                <p className="label-xs text-rose-600 dark:text-rose-400">
                  Share unavailable
                </p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">
                  Could not refresh this code
                </h2>
                <p className="mt-2 max-w-[24ch] text-sm leading-6 text-muted">
                  {error}
                </p>
                <SecondaryButton
                  type="button"
                  className="mt-5 h-12 px-5"
                  onClick={handleRefresh}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </span>
                </SecondaryButton>
              </div>
            ) : (
              <div className="relative w-full rounded-[2.85rem] border border-black/[0.08] bg-white px-3 py-4 shadow-[0_38px_100px_rgba(15,23,42,0.13)] dark:border-white/[0.08] dark:bg-zinc-950 sm:px-4 sm:py-5">
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-full bg-brandRose/10 blur-3xl dark:bg-brandCyan/10" />

                {isLoadingQr ? (
                  generatedQr ? (
                    <div className="flex min-h-[26rem] items-center justify-center sm:min-h-[28rem]">
                      <QRCodeSVG
                        value={generatedQr.url}
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
                      <div className="skeleton h-[22.5rem] w-full max-w-[22.5rem] rounded-[2.1rem] sm:h-[23.5rem] sm:max-w-[23.5rem]" />
                    </div>
                  )
                ) : generatedQr ? (
                  <div className="flex min-h-[26rem] items-center justify-center sm:min-h-[28rem]">
                    <QRCodeSVG
                      value={generatedQr.url}
                      size={440}
                      level="H"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#050505"
                      className="relative h-auto w-full max-w-[26rem]"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-center">
            <p className="text-lg font-semibold tracking-tight text-foreground">
              {getShareInstruction(sharePayload?.preferredShareType)}
            </p>
            {isLoadingQr && generatedQr ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Updating quietly
              </p>
            ) : null}
            {!isOnline && generatedQr ? (
              <p className="mx-auto max-w-[30ch] text-sm leading-6 text-amber-700 dark:text-amber-300">
                Offline. Your last ready QR is still available.
              </p>
            ) : null}
            {error && generatedQr ? (
              <p className="mx-auto max-w-[30ch] text-sm leading-6 text-amber-700 dark:text-amber-300">
                Showing your last ready QR while Dotly reconnects.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[1.55rem] border border-black/[0.06] bg-white/76 p-2 shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:border-white/[0.08] dark:bg-white/[0.045]">
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton
                type="button"
                size="sm"
                className="h-13 w-full rounded-[1.2rem]"
                disabled={!generatedQr || isLoadingQr || shareLocked}
                onClick={() => void copyCurrentLink("Link copied")}
              >
                <span className="inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy
                </span>
              </SecondaryButton>

              <PrimaryButton
                type="button"
                size="sm"
                className="h-13 w-full rounded-[1.2rem]"
                disabled={!generatedQr || isLoadingQr || shareLocked}
                onClick={() => void handleShare()}
              >
                <span className="inline-flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Send
                </span>
              </PrimaryButton>
            </div>
          </div>

          {!shareLocked && error && generatedQr ? (
            <button
              type="button"
              className="mx-auto inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              Retry refresh
            </button>
          ) : null}

          {feedback ? (
            <p
              className={cn(
                "px-1 text-sm",
                feedback.tone === "success"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
