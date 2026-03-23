"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Copy, RefreshCw, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { isApiError } from "@/lib/api/client";
import { personaApi } from "@/lib/api/persona-api";
import { qrApi } from "@/lib/api/qr-api";
import { routes } from "@/lib/constants/routes";
import {
  getPersonaFastShare,
  getShareFastSnapshot,
  seedMyFastShare,
  upsertPersonaFastShare,
} from "@/lib/share-fast-store";
import { cn } from "@/lib/utils/cn";
import type {
  MyFastSharePayload,
  PersonaSummary,
  QrTokenSummary,
  QuickConnectQrSummary,
} from "@/types/persona";
import type { UserProfile } from "@/types/user";

import { VerificationPrompt } from "../auth/verification-prompt";
import { QrModeToggle } from "./qr-mode-toggle";

interface QrGeneratorPanelProps {
  initialFastShare?: MyFastSharePayload | null;
  personas: PersonaSummary[];
  user: UserProfile;
}

type QrMode = "standard" | "quick_connect";
type GeneratedQr = QrTokenSummary | QuickConnectQrSummary;
type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

const QUICK_CONNECT_DEFAULTS = {
  durationHours: 12,
  maxUses: 25,
} as const;

function toStandardQrSummary(sharePayload: NonNullable<MyFastSharePayload["sharePayload"]>): QrTokenSummary {
  return {
    id: sharePayload.personaId,
    code: sharePayload.username,
    type: "profile",
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

function getModeLabel(mode: QrMode, persona: PersonaSummary | null): string {
  if (mode === "quick_connect") {
    return "Quick Connect";
  }

  return "Profile";
}

function getModeDescription(mode: QrMode, persona: PersonaSummary | null): string {
  if (mode === "quick_connect") {
    return `They scan once and jump into a temporary introduction flow that stays live for ${QUICK_CONNECT_DEFAULTS.durationHours} hours.`;
  }

  return persona
    ? "They open your public profile and choose the next step from there."
    : "They open your public profile from this QR.";
}

export function QrGeneratorPanel({
  initialFastShare = null,
  personas,
  user,
}: QrGeneratorPanelProps) {
  const router = useRouter();
  const shareFastSnapshot = getShareFastSnapshot();
  const initialSelectionId =
    initialFastShare?.selectedPersonaId ?? shareFastSnapshot.selectedPersonaId;
  const initialPersonaId =
    initialSelectionId && personas.some((persona) => persona.id === initialSelectionId)
      ? initialSelectionId
      : personas[0]?.id ?? "";
  const initialSharePayload =
    initialFastShare?.sharePayload ??
    (initialPersonaId ? getPersonaFastShare(initialPersonaId) : null);
  const initialShareQr = initialSharePayload
    ? toStandardQrSummary(initialSharePayload)
    : null;
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    initialPersonaId,
  );
  const [mode, setMode] = useState<QrMode>("standard");
  const initialCacheKey =
    initialPersonaId && initialShareQr ? `${initialPersonaId}:standard` : "";
  const [generatedQr, setGeneratedQr] = useState<GeneratedQr | null>(
    initialShareQr,
  );
  const [generatedQrKey, setGeneratedQrKey] = useState(initialCacheKey);
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

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );

  const canGenerateProfileQr = hasUnlockedTrustRequirement(
    user,
    "create_profile_qr",
  );
  const canGenerateQuickConnectQr =
    hasUnlockedTrustRequirement(user, "create_quick_connect_qr") &&
    Boolean(selectedPersona?.sharingCapabilities?.primaryActions.instantConnect);
  const shareLocked = !canGenerateProfileQr && !canGenerateQuickConnectQr;
  const canGenerateCurrentMode =
    mode === "standard" ? canGenerateProfileQr : canGenerateQuickConnectQr;
  const cacheKey = selectedPersonaId ? `${selectedPersonaId}:${mode}` : "";
  const modeLabel = getModeLabel(mode, selectedPersona);
  const identityLine = [selectedPersona?.jobTitle, selectedPersona?.companyName]
    .filter(Boolean)
    .join(" at ");
  const isVerified = user.security.trustBadge === "verified";
  const hasMultiplePersonas = personas.length > 1;
  const shareTitle = selectedPersona
    ? `${selectedPersona.fullName} on Dotly`
    : "Dotly";
  const shareText = selectedPersona
    ? mode === "quick_connect"
      ? `Connect instantly with ${selectedPersona.fullName} on Dotly.`
      : `Open ${selectedPersona.fullName}'s profile on Dotly.`
    : "Open this Dotly profile.";

  useEffect(() => {
    if (initialFastShare) {
      seedMyFastShare(initialFastShare);
    }
  }, [initialFastShare]);

  useEffect(() => {
    if (mode === "quick_connect" && !canGenerateQuickConnectQr) {
      setMode("standard");
    }
  }, [canGenerateQuickConnectQr, mode]);

  useEffect(() => {
    if (!selectedPersonaId || !canGenerateCurrentMode) {
      setGeneratedQr(null);
      setIsLoadingQr(false);
      setError(null);
      return;
    }

    setFeedback(null);
    setError(null);

    const cachedQr = cacheRef.current.get(cacheKey);
    if (cachedQr) {
      setGeneratedQr(cachedQr);
      setIsLoadingQr(false);
      return;
    }

    if (mode === "standard") {
      const cachedSharePayload = getPersonaFastShare(selectedPersonaId);

      if (cachedSharePayload) {
        const nextQr = toStandardQrSummary(cachedSharePayload);
        cacheRef.current.set(cacheKey, nextQr);
        setGeneratedQr(nextQr);
        setGeneratedQrKey(cacheKey);
        setIsLoadingQr(false);
        return;
      }
    }

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    if (generatedQrKey !== cacheKey) {
      setGeneratedQr(null);
    }
    setIsLoadingQr(true);

    void (async () => {
      try {
        let nextQr: GeneratedQr;

        if (mode === "standard") {
          const sharePayload = await personaApi.getFastShare(selectedPersonaId);
          upsertPersonaFastShare(sharePayload, { selected: true });
          nextQr = toStandardQrSummary(sharePayload);
        } else {
          nextQr = await qrApi.createQuickConnectQr(
            selectedPersonaId,
            QUICK_CONNECT_DEFAULTS,
          );
        }

        if (latestRequestRef.current !== requestId) {
          return;
        }

        cacheRef.current.set(cacheKey, nextQr);
        setGeneratedQr(nextQr);
        setGeneratedQrKey(cacheKey);
      } catch (submissionError) {
        if (isApiError(submissionError) && submissionError.status === 401) {
          router.replace(
            `${routes.public.login}?next=${routes.app.qr}&reason=expired`,
          );
          router.refresh();
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
    canGenerateCurrentMode,
    generatedQrKey,
    mode,
    refreshNonce,
    router,
    selectedPersonaId,
  ]);

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
      setFeedback({ tone: "success", message: successMessage });
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
      await copyCurrentLink("Link copied. Native share is unavailable here.");
      return;
    }

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: generatedQr.url,
      });
      setFeedback({ tone: "success", message: "Share sheet opened." });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return;
      }

      await copyCurrentLink("Link copied instead.");
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
    <section className="relative isolate overflow-hidden rounded-[2.5rem] border border-black/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.98)_100%)] p-4 shadow-[0_36px_120px_rgba(15,23,42,0.12)] dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,rgba(18,18,20,0.96)_0%,rgba(8,8,9,0.98)_100%)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
        <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-brandRose/12 blur-3xl dark:bg-brandCyan/10" />
        <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-brandViolet/12 blur-3xl dark:bg-brandCyan/8" />
      </div>

      <div className="relative z-10 flex min-h-[calc(100dvh-3rem)] flex-col gap-5 sm:min-h-[calc(100dvh-4rem)]">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="label-xs text-muted">Share</p>
              <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">
                Show your QR
              </h1>
              <p className="max-w-[30rem] text-sm leading-6 text-muted">
                Keep this screen open and let the other person scan.
              </p>
            </div>

            {hasMultiplePersonas ? (
              <label className="min-w-0 max-w-[13rem] flex-1 space-y-1.5" htmlFor="qr-persona">
                <span className="label-xs block text-right text-muted">Persona</span>
                <select
                  id="qr-persona"
                  value={selectedPersonaId}
                  onChange={(event) => setSelectedPersonaId(event.target.value)}
                  className="min-h-12 w-full rounded-2xl border border-black/[0.08] bg-white/88 px-4 text-sm font-medium text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/15 dark:border-white/[0.08] dark:bg-white/[0.06] dark:focus:border-brandCyan dark:focus:ring-brandCyan/15"
                >
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-full border border-black/[0.06] bg-black/[0.03] px-3 py-1.5 text-xs font-semibold text-muted dark:border-white/[0.08] dark:bg-white/[0.05]">
                @{selectedPersona?.username}
              </div>
            )}
          </div>

          {selectedPersona ? (
            <div className="flex items-center gap-3 rounded-[1.75rem] border border-black/[0.06] bg-white/78 px-4 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] dark:border-white/[0.08] dark:bg-white/[0.045] sm:px-5">
              {selectedPersona.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPersona.profilePhotoUrl}
                  alt={selectedPersona.fullName}
                  className="h-14 w-14 rounded-[1.2rem] object-cover"
                />
              ) : (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] text-base font-semibold text-white"
                  style={{ background: avatarGradient(selectedPersona.fullName) }}
                >
                  {getInitials(selectedPersona.fullName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {selectedPersona.fullName}
                  </h2>
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>

                {identityLine ? (
                  <p className="truncate text-sm text-muted">{identityLine}</p>
                ) : null}

                {selectedPersona.tagline ? (
                  <p className="mt-1 line-clamp-1 text-sm text-foreground/80 dark:text-white/75">
                    {selectedPersona.tagline}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {canGenerateQuickConnectQr ? (
            <div>
              <QrModeToggle value={mode} onChange={setMode} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="mx-auto flex w-full max-w-[26rem] flex-1 items-center justify-center">
            {shareLocked ? (
              <VerificationPrompt
                email={user.email}
                title="QR sharing is waiting on verification"
                description="Verify your email or mobile factor to unlock a live share card for in-person introductions."
                compact
                className="w-full"
              />
            ) : error ? (
              <div className="flex min-h-[21rem] w-full flex-col items-center justify-center rounded-[2rem] border border-rose-500/20 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:bg-zinc-950">
                <p className="label-xs text-rose-600 dark:text-rose-400">Share unavailable</p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  Could not refresh this code
                </h3>
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
              <div className="relative w-full rounded-[2.25rem] border border-black/[0.08] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(15,23,42,0.10)] dark:border-white/[0.08] dark:bg-zinc-950 sm:px-7 sm:py-7">
                <div className="pointer-events-none absolute inset-x-10 top-1/2 h-28 -translate-y-1/2 rounded-full bg-brandRose/10 blur-3xl dark:bg-brandCyan/10" />

                {isLoadingQr ? (
                  <div className="flex min-h-[22rem] flex-col items-center justify-center gap-4 sm:min-h-[24rem]">
                    <div className="skeleton h-[19rem] w-full max-w-[19rem] rounded-[1.8rem] sm:h-[20rem] sm:max-w-[20rem]" />
                    <div className="skeleton h-3 w-40 rounded-full" />
                  </div>
                ) : generatedQr ? (
                  <div className="flex min-h-[22rem] items-center justify-center sm:min-h-[24rem]">
                    <QRCodeSVG
                      value={generatedQr.url}
                      size={320}
                      level="H"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#050505"
                      className="relative h-auto w-full max-w-[20rem]"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-center">
            <p className="text-base font-semibold text-foreground">
              {mode === "quick_connect"
                ? "Scan to start a temporary intro"
                : "Scan to open my profile"}
            </p>
            <p className="mx-auto max-w-[34ch] text-sm leading-6 text-muted">
              {getModeDescription(mode, selectedPersona)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton
              type="button"
              className="h-14 w-full"
              disabled={!generatedQr || isLoadingQr || shareLocked}
              onClick={() => void copyCurrentLink("Link copied.")}
            >
              <span className="inline-flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy Link
              </span>
            </SecondaryButton>

            <PrimaryButton
              type="button"
              className="h-14 w-full"
              disabled={!generatedQr || isLoadingQr || shareLocked}
              onClick={() => void handleShare()}
            >
              <span className="inline-flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Share link
              </span>
            </PrimaryButton>
          </div>

          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              {modeLabel}
            </p>

            {!shareLocked ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh QR
              </button>
            ) : null}
          </div>

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
