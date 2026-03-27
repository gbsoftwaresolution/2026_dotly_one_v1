"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Copy, RefreshCw, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { CustomSelect } from "@/components/shared/custom-select";
import { ExternalImage } from "@/components/shared/external-image";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { isApiError } from "@/lib/api/client";
import { personaApi } from "@/lib/api/persona-api";
import { routes } from "@/lib/constants/routes";
import { resolvePreferredPersonaId } from "@/lib/persona/default-persona";
import { formatPublicHandle } from "@/lib/persona/routing-ux";
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
import type { CurrentUserReferral, UserProfile } from "@/types/user";

import { VerificationPrompt } from "../auth/verification-prompt";
import { ConnectionProgressNote } from "../analytics/connection-progress-note";

interface QrGeneratorPanelProps {
  initialFastShare?: MyFastSharePayload | null;
  initialReferral?: CurrentUserReferral | null;
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
    publicIdentifier: value.persona.publicIdentifier ?? value.persona.username,
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
    code: sharePayload.publicIdentifier ?? sharePayload.username,
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

function buildReferralSignupUrl(referralCode: string): string {
  const normalizedCode = referralCode.trim().toUpperCase();

  if (typeof window === "undefined") {
    return `${routes.public.signup}?ref=${encodeURIComponent(normalizedCode)}`;
  }

  const inviteUrl = new URL(routes.public.signup, window.location.origin);
  inviteUrl.searchParams.set("ref", normalizedCode);
  return inviteUrl.toString();
}

export function QrGeneratorPanel({
  initialFastShare = null,
  initialReferral = null,
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
  const activationMilestones = user.activation?.milestones;
  const hasShareCompleted = Boolean(
    activationMilestones?.firstShareCompletedAt,
  );
  const hasRequestReceived = Boolean(
    activationMilestones?.firstRequestReceivedAt,
  );
  const shareTitle = selectedPersona
    ? `${formatPublicHandle(sharePayload?.publicIdentifier ?? selectedPersona.username)} on Dotly`
    : "Dotly";
  const shareText = selectedPersona
    ? sharePayload?.preferredShareType === "instant_connect"
      ? `Connect with ${formatPublicHandle(sharePayload?.publicIdentifier ?? selectedPersona.username)} on Dotly.`
      : `Open ${formatPublicHandle(sharePayload?.publicIdentifier ?? selectedPersona.username)} on Dotly.`
    : "Open this Dotly profile.";
  const referralSignupUrl = initialReferral
    ? buildReferralSignupUrl(initialReferral.referralCode)
    : null;
  const personaOptions = personas.map((persona) => ({
    value: persona.id,
    label: persona.fullName,
  }));
  const hasCachedOrGeneratedQr =
    generatedQr !== null ||
    Boolean(selectedPersonaId && getPersonaFastShare(selectedPersonaId));

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

    if (!isOnline && hasCachedOrGeneratedQr) {
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
    hasCachedOrGeneratedQr,
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

  async function handleCopyReferralCode() {
    if (!initialReferral) {
      return;
    }

    try {
      await navigator.clipboard.writeText(initialReferral.referralCode);
      setFeedback(null);
      showToast("Referral code copied");
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not copy the referral code right now.",
      });
    }
  }

  async function handleInviteShare() {
    if (!initialReferral || !referralSignupUrl) {
      return;
    }

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Create your Dotly",
          text: "Claim your Dotly and get your QR ready for the next introduction.",
          url: referralSignupUrl,
        });
        setFeedback(null);
        return;
      } catch (shareError) {
        if (
          shareError instanceof DOMException &&
          shareError.name === "AbortError"
        ) {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(referralSignupUrl);
      setFeedback(null);
      showToast("Invite link copied");
    } catch {
      setFeedback({
        tone: "error",
        message: "Could not copy the invite link right now.",
      });
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
    <div className="space-y-6 motion-safe:animate-[fade-in_420ms_ease-out]">
      <div className="rounded-[2rem] bg-white/40 backdrop-blur-[40px] saturate-[200%] ring-1 ring-black/5 dark:bg-zinc-900/40 dark:ring-white/10 shadow-2xl p-5 sm:p-8 flex flex-col gap-8 relative overflow-hidden">
        {/* Subtle gradient glow behind the card content */}
        <div className="absolute -inset-1/2 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl rounded-full opacity-50 pointer-events-none" />

        <div className="space-y-4 relative z-10">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Your Active Dotly
            </h2>
            <p className="text-sm leading-relaxed text-muted max-w-[280px] mx-auto">
              Let someone step into your contact identity instead of asking for
              your number.
            </p>
          </div>

          {personas.length > 1 ? (
            <div className="space-y-1.5 relative z-10">
              <label
                className="label-xs text-muted"
                htmlFor="qr-persona-select"
              >
                Leading with
              </label>
              <CustomSelect
                id="qr-persona-select"
                className="min-h-[54px] w-full rounded-2xl bg-white/50 px-4 text-[15px] font-medium text-foreground shadow-sm ring-1 ring-inset ring-black/5 outline-none transition-all focus:bg-white/80 focus:ring-black/10 dark:bg-zinc-800/50 dark:ring-white/10 dark:focus:bg-zinc-800/80 backdrop-blur-md"
                value={selectedPersonaId ?? ""}
                onChange={(value) => setSelectedPersonaId(value)}
                options={personaOptions}
              />
            </div>
          ) : null}

          <div className="flex items-start gap-3 relative z-10">
            {selectedPersona ? (
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white/50 px-4 py-4 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 sm:px-5 backdrop-blur-md">
                {selectedPersona.profilePhotoUrl ? (
                  <ExternalImage
                    src={selectedPersona.profilePhotoUrl}
                    alt={selectedPersona.fullName}
                    width={48}
                    height={48}
                    sizes="48px"
                    className="h-11 w-11 rounded-xl object-cover sm:h-12 sm:w-12"
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white sm:h-12 sm:w-12"
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
                      {formatPublicHandle(
                        sharePayload?.publicIdentifier ??
                          selectedPersona.username,
                      )}
                    </h1>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    ) : null}
                  </div>

                  <p className="truncate text-sm leading-6 text-muted">
                    {[selectedPersona.fullName, identityMetaLine]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                </div>
              </div>
            ) : null}

            {personas.length > 1 ? (
              <Link href={routes.app.personas} className="shrink-0">
                <SecondaryButton
                  type="button"
                  size="sm"
                  className="h-11 rounded-2xl px-4 sm:h-12"
                >
                  Switch Dotly
                </SecondaryButton>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="h-px bg-black/5 dark:bg-white/5 -mx-5 sm:-mx-8 relative z-10" />

        <div className="flex flex-1 flex-col gap-6 relative z-10">
          <div className="flex flex-1 flex-col justify-center gap-4">
            <ConnectionProgressNote
              analytics={analytics}
              className="mx-auto w-full max-w-md"
            />

            <div className="mx-auto flex w-full flex-1 items-center justify-center relative z-10">
              {shareLocked ? (
                <VerificationPrompt
                  email={user.email}
                  title="QR sharing is waiting on verification"
                  description="Verify your email or phone to unlock the premium share moment."
                  compact
                  className="w-full"
                />
              ) : error && !generatedQr ? (
                <div className="flex min-h-[24rem] w-full flex-col items-center justify-center rounded-3xl bg-rose-500/5 ring-1 ring-inset ring-rose-500/20 p-6 text-center shadow-inner backdrop-blur-md">
                  <p className="label-xs text-rose-600 dark:text-rose-400">
                    Introduction surface unavailable
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    Could not refresh your Dotly
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
                <div className="relative w-full rounded-3xl bg-white px-4 py-5 shadow-xl ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10 sm:px-5 sm:py-6">
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
                        <div className="skeleton h-[22.5rem] w-full max-w-[22.5rem] rounded-3xl sm:h-[23.5rem] sm:max-w-[23.5rem]" />
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

            <div className="space-y-2 text-center relative z-10">
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
                  Showing your last ready Dotly while the live share surface
                  reconnects.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="h-px bg-black/5 dark:bg-white/5 -mx-5 sm:-mx-8 relative z-10" />

        <div className="space-y-4 relative z-10">
          <div className="rounded-2xl bg-white/50 p-2 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 backdrop-blur-md relative z-10">
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton
                type="button"
                size="sm"
                className="h-13 w-full rounded-2xl"
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
                className="h-13 w-full rounded-2xl"
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

          <div className="rounded-2xl bg-white/50 p-4 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 backdrop-blur-md">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {hasShareCompleted ? "Momentum signal" : "First exchange flow"}
              </p>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Guide the first exchange
              </h2>
              <p className="text-sm leading-6 text-muted">
                {hasShareCompleted
                  ? hasRequestReceived
                    ? "Your Dotly is already landing. A real scan or profile open already happened, so keep requests and inbox close while the context is still warm."
                    : "Your Dotly is already landing. A real scan or profile open already happened, and the next move is clean follow-through before the moment cools."
                  : "Keep the introduction effortless: show the Dotly, let them choose their path in, and follow through while the relationship is still taking shape."}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Lead with Dotly",
                  description:
                    "Use one polished share surface instead of giving out your number or explaining your profile.",
                },
                {
                  step: "02",
                  title: hasShareCompleted
                    ? "Momentum started"
                    : "Let them choose",
                  description: hasShareCompleted
                    ? "Dotly has already seen a real open or scan from this introduction flow."
                    : "Dotly can route them into curated access, instant connect, or the right next step.",
                },
                {
                  step: "03",
                  title: hasRequestReceived
                    ? "Reply while it is warm"
                    : "Protect the follow-through",
                  description: hasRequestReceived
                    ? "A first incoming request already landed. Keep the response loop personal and fast."
                    : "Check requests or inbox so the introduction turns into a trusted relationship, not a missed moment.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl bg-black/[0.03] px-4 py-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.04] dark:ring-white/10"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {item.step}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link className="sm:flex-1" href={routes.app.requests}>
                <SecondaryButton className="w-full" size="sm">
                  Review requests
                </SecondaryButton>
              </Link>
              <Link className="sm:flex-1" href={routes.app.inbox}>
                <SecondaryButton className="w-full" size="sm">
                  Review inbox
                </SecondaryButton>
              </Link>
            </div>
          </div>

          {initialReferral ? (
            <div className="rounded-2xl bg-white/50 p-4 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10 backdrop-blur-md">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Network invitation
                </p>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Invite someone into the Dotly network
                </h2>
                <p className="text-sm leading-6 text-muted">
                  Share your signup link after the introduction so the next
                  person can claim a Dotly of their own with your referral
                  attached.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-black/[0.03] px-4 py-3 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    Referral code
                  </p>
                  <p className="mt-1 truncate font-mono text-base font-semibold tracking-[0.2em] text-foreground">
                    {initialReferral.referralCode}
                  </p>
                </div>
                <SecondaryButton
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void handleCopyReferralCode()}
                >
                  Copy code
                </SecondaryButton>
              </div>

              <PrimaryButton
                type="button"
                size="sm"
                className="mt-3 h-13 w-full rounded-2xl"
                onClick={() => void handleInviteShare()}
              >
                Invite someone
              </PrimaryButton>
            </div>
          ) : null}

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
    </div>
  );
}
