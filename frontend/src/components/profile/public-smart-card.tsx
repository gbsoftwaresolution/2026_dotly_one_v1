"use client";

import { useEffect, useRef, useState } from "react";

import {
  AtSign,
  ArrowUpRight,
  Check,
  Download,
  MessageCircle,
  Phone,
} from "lucide-react";

import { Card } from "@/components/shared/card";
import { ExternalImage } from "@/components/shared/external-image";
import { VerificationPrompt } from "@/components/auth/verification-prompt";
import { PrimaryButton } from "@/components/shared/primary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { publicApi, relationshipApi, requestApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { buildRequestKey } from "@/lib/network/request-key";
import { useNetworkStatus } from "@/lib/network/use-network-status";
import { getCanonicalPublicSlug } from "@/lib/persona/public-profile-path";
import { resolvePreferredPersonaId } from "@/lib/persona/default-persona";
import { getPublicTrustPresentation } from "@/lib/persona/public-trust";
import {
  formatPublicHandle,
  getPublicIdentityLine,
} from "@/lib/persona/routing-ux";
import {
  getPublicSmartCardActionLinks,
  getPublicSmartCardDirectActions,
  hasPublicSmartCardDirectActions,
  resolvePublicSmartCardPrimaryCta,
} from "@/lib/persona/smart-card";
import { cn } from "@/lib/utils/cn";
import type {
  PersonaSmartCardPrimaryAction,
  PersonaSummary,
  PublicProfile,
  PublicProfileRequestTarget,
} from "@/types/persona";
import type { UserProfile } from "@/types/user";

interface PublicSmartCardProps {
  profile: PublicProfile;
  initialPersonas?: PersonaSummary[];
  requestAccessHref?: string;
  isAuthenticated?: boolean;
  loginHref?: string;
  personaLoadError?: string | null;
  personasLoading?: boolean;
  currentUser?: UserProfile | null;
}

interface SmartAction {
  key: "call" | "whatsapp" | "email" | "vcard";
  label: string;
  href: string;
  icon: typeof Phone;
}

function avatarHue(seed: string): number {
  return ((seed.charCodeAt(0) || 72) * 137) % 360;
}

function getPersonaPublicHandle(
  persona: Pick<PersonaSummary, "publicUrl" | "username">,
) {
  return formatPublicHandle(
    getCanonicalPublicSlug(persona.publicUrl, persona.username),
  );
}

async function downloadVcard(href: string, username: string) {
  const trimmedHref = href.trim();

  if (!trimmedHref) {
    throw new Error("Unable to download contact");
  }

  let resolvedHref: string;

  try {
    const validatedUrl = new URL(trimmedHref, document.baseURI);

    if (
      validatedUrl.protocol !== "http:" &&
      validatedUrl.protocol !== "https:"
    ) {
      throw new Error("Unsupported vCard URL");
    }

    resolvedHref = trimmedHref;
  } catch {
    throw new Error("Unable to download contact");
  }

  const response = await window.fetch(resolvedHref, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Unable to download contact");
  }

  const file = await response.blob();

  if (!file.size) {
    throw new Error("Unable to download contact");
  }

  if (typeof URL.createObjectURL !== "function") {
    window.location.assign(resolvedHref);
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  const safeFilename =
    username.trim().replace(/[^a-z0-9_-]+/gi, "-") || "contact";

  anchor.href = objectUrl;
  anchor.download = `${safeFilename}.vcf`;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } catch {
    window.location.assign(resolvedHref);
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

function getPrimaryCtaLabel(
  primaryAction: PersonaSmartCardPrimaryAction | "login",
): string {
  switch (primaryAction) {
    case "login":
      return "Log in to connect with me";
    case "request_access":
      return "Request to connect with me";
    case "instant_connect":
      return "Connect with me";
    case "contact_me":
      return "Connect with me";
  }
}

function getCardActionSummary(
  primaryAction: PersonaSmartCardPrimaryAction,
  fullName: string,
): string {
  switch (primaryAction) {
    case "request_access":
      return `Request curated access to ${fullName}.`;
    case "instant_connect":
      return "Connect instantly without trading phone numbers.";
    case "contact_me":
      return `Choose the best way to connect with ${fullName}.`;
  }
}

type PrimaryCtaState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "settling" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type DirectActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type InstantConnectUiState =
  | { status: "idle" }
  | { status: "connected"; message: string }
  | { status: "fallback"; message: string };

function toFriendlyRequestMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Log in to send a request from one of your Dotlys.";
    }

    if (error.status === 429) {
      return "Too many attempts. Please wait a few minutes.";
    }

    if (error.status === 403) {
      const msg = error.message ?? "";

      if (
        msg.includes("blocked") ||
        msg.toLowerCase().includes("you have blocked") ||
        msg.toLowerCase().includes("has blocked you")
      ) {
        return "You cannot connect with this profile.";
      }

      return "This profile is not accepting curated requests right now.";
    }

    if (error.status === 409) {
      return "Request already pending.";
    }

    return error.message;
  }

  return "We could not send your request right now. Please try again.";
}

function isAlreadyConnectedError(error: ApiError): boolean {
  const message = error.message.toLowerCase();

  return error.status === 409 || message.includes("already");
}

function isRestrictedConnectError(error: ApiError): boolean {
  return error.status === 403;
}

function isBlockedConnectError(error: ApiError): boolean {
  const message = error.message.toLowerCase();

  return error.status === 403 && message.includes("blocked");
}

function isVerificationRequiredError(error: ApiError): boolean {
  const message = error.message.toLowerCase();

  return error.status === 403 && message.includes("verified");
}

function getBlockedConnectMessage(error: ApiError): string {
  const message = error.message.toLowerCase();

  if (message.includes("you have blocked")) {
    return "You have blocked this user. Unblock them before connecting.";
  }

  if (message.includes("has blocked you")) {
    return "This user has blocked you, so this connection cannot be completed.";
  }

  return "This connection is blocked and cannot be completed.";
}

function getVerificationRequiredMessage(): string {
  return "Verify your email or phone to connect with confidence.";
}

function getInstantConnectErrorMessage(error: ApiError): string {
  if (error.status === 401) {
    return "Log in to connect with me.";
  }

  if (error.status === 429) {
    return "Please wait a moment and try again.";
  }

  return "Couldn't connect right now. Try again.";
}

function SmartCardHeroShell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-[32px] overflow-hidden bg-white/60 backdrop-blur-3xl p-0 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10">
      <div className="relative overflow-hidden px-5 py-6 sm:px-6 sm:py-7">
        <div className="relative z-10">{children}</div>
      </div>
    </Card>
  );
}

function SmartCardTrustBadge({ trust }: { trust: PublicProfile["trust"] }) {
  const presentation = getPublicTrustPresentation(trust);

  if (!presentation) {
    return null;
  }

  return (
    <span
      aria-label={presentation.shortLabel}
      title={presentation.detail}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
        trust.isStrongVerified
          ? "border-emerald-700/10 bg-emerald-700 text-white dark:border-emerald-400/20 dark:bg-emerald-400 dark:text-slate-950"
          : "border-emerald-700/18 bg-emerald-700/[0.08] text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/[0.12] dark:text-emerald-200",
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      <span>{presentation.shortLabel}</span>
    </span>
  );
}

function getSafeExternalWebsiteUrl(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getCompactWebsiteLabel(value: string): string {
  try {
    const { hostname } = new URL(value);
    return hostname.replace(/^www\./, "");
  } catch {
    return "Website";
  }
}

export function PublicSmartCardSkeleton() {
  return (
    <SmartCardHeroShell>
      <div className="space-y-6 text-center">
        <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-black/8 dark:bg-white/10" />
        <div className="space-y-3">
          <div className="mx-auto h-8 w-40 animate-pulse rounded-full bg-black/8 dark:bg-white/10" />
          <div className="mx-auto h-5 w-32 animate-pulse rounded-full bg-black/6 dark:bg-white/8" />
          <div className="mx-auto h-4 w-44 animate-pulse rounded-full bg-black/6 dark:bg-white/8" />
        </div>
        <div className="h-14 w-full animate-pulse rounded-[20px] bg-black/8 dark:bg-white/10" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[88px] animate-pulse rounded-[22px] bg-black/6 dark:bg-white/8"
            />
          ))}
        </div>
      </div>
    </SmartCardHeroShell>
  );
}

export function PublicSmartCard({
  profile,
  initialPersonas = [],
  requestAccessHref = "#request-access-panel",
  isAuthenticated = true,
  loginHref,
  personaLoadError = null,
  personasLoading = false,
  currentUser = null,
}: PublicSmartCardProps) {
  const isOnline = useNetworkStatus();
  const config = profile.smartCard;
  const [primaryCtaState, setPrimaryCtaState] = useState<PrimaryCtaState>({
    status: "idle",
  });
  const [instantConnectUiState, setInstantConnectUiState] =
    useState<InstantConnectUiState>({ status: "idle" });
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    resolvePreferredPersonaId(initialPersonas),
  );
  const [directActionState, setDirectActionState] = useState<DirectActionState>(
    {
      status: "idle",
    },
  );
  const [showLoginCta, setShowLoginCta] = useState(!isAuthenticated);
  const [showCustomizeOptions, setShowCustomizeOptions] = useState(false);
  const [showDirectActions, setShowDirectActions] = useState(false);
  const [isVcardDownloading, setIsVcardDownloading] = useState(false);
  const [requestTarget, setRequestTarget] =
    useState<PublicProfileRequestTarget | null>(null);
  const [requestSucceeded, setRequestSucceeded] = useState(false);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const directActionFeedbackTimeoutRef = useRef<number | null>(null);
  const instantConnectMeasureIdRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const connectKeyRef = useRef<string | null>(null);
  const [showSlowNetworkHint, setShowSlowNetworkHint] = useState(false);

  useEffect(() => {
    setShowLoginCta(!isAuthenticated);
  }, [isAuthenticated]);

  useEffect(() => {
    if (initialPersonas.length === 0) {
      setSelectedPersonaId("");
      return;
    }

    setSelectedPersonaId((current) => {
      if (
        current &&
        initialPersonas.some((persona) => persona.id === current)
      ) {
        return current;
      }

      return resolvePreferredPersonaId(initialPersonas);
    });
  }, [initialPersonas]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      connectAbortRef.current?.abort();
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }

      if (directActionFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(directActionFeedbackTimeoutRef.current);
      }
    };
  }, []);

  if (!config) {
    return (
      <SmartCardHeroShell>
        <div className="space-y-3 py-6 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-black/5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:bg-white/8" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Profile not available
          </h1>
        </div>
      </SmartCardHeroShell>
    );
  }

  const publicIdentifier =
    profile.publicIdentifier?.trim().toLowerCase() ||
    getCanonicalPublicSlug(profile.publicUrl, profile.username);
  const hue = avatarHue(publicIdentifier);
  const hasDirectActions = hasPublicSmartCardDirectActions(profile);
  const actionLinks = getPublicSmartCardActionLinks(config);
  const directActionKeys = getPublicSmartCardDirectActions(config, profile);
  const smartActions: SmartAction[] = [];

  if (directActionKeys.includes("call") && actionLinks?.call) {
    smartActions.push({
      key: "call",
      label: "Call",
      href: actionLinks.call,
      icon: Phone,
    });
  }

  if (directActionKeys.includes("whatsapp") && actionLinks?.whatsapp) {
    smartActions.push({
      key: "whatsapp",
      label: "WhatsApp",
      href: actionLinks.whatsapp,
      icon: MessageCircle,
    });
  }

  if (directActionKeys.includes("email") && actionLinks?.email) {
    smartActions.push({
      key: "email",
      label: "Email",
      href: actionLinks.email,
      icon: AtSign,
    });
  }

  if (directActionKeys.includes("vcard") && actionLinks?.vcard) {
    smartActions.push({
      key: "vcard",
      label: "Save card",
      href: actionLinks.vcard,
      icon: Download,
    });
  }

  const resolvedPrimaryCta = resolvePublicSmartCardPrimaryCta(
    config.primaryAction,
    {
      instantConnectUrl: profile.instantConnectUrl,
      actionState: config.actionState,
      hasDirectActions,
    },
  );
  const primaryAction = resolvedPrimaryCta.action;
  const supportsInstantConnectFallback =
    resolvedPrimaryCta.requestedAction === "instant_connect" &&
    config.actionState.requestAccessEnabled;
  const isConnected = instantConnectUiState.status === "connected";
  const hasPersonaSelection = initialPersonas.length > 0;
  const hasMultiplePersonas = initialPersonas.length > 1;
  const selectedPersona = initialPersonas.find(
    (persona) => persona.id === selectedPersonaId,
  );
  const hasAlternatePersonaChoice = isAuthenticated && hasMultiplePersonas;
  const displayedPrimaryAction = primaryAction;
  const primaryCtaAction =
    showLoginCta && displayedPrimaryAction !== "contact_me"
      ? "login"
      : displayedPrimaryAction;
  const primaryCtaLabel = requestSucceeded ? (
    <>
      Request sent <Check className="ml-1 inline h-4 w-4" />
    </>
  ) : isConnected ? (
    <>
      Connected <Check className="ml-1 inline h-4 w-4" />
    </>
  ) : (
    getPrimaryCtaLabel(primaryCtaAction)
  );
  const cardActionSummary =
    displayedPrimaryAction === "instant_connect"
      ? `Tap Connect with me to save ${profile.fullName} without sharing numbers first.`
      : getCardActionSummary(displayedPrimaryAction, profile.fullName);
  const trimmedTagline = profile.tagline?.trim() || null;
  const trimmedCompanyName = profile.companyName?.trim() || null;
  const websiteUrl = getSafeExternalWebsiteUrl(profile.websiteUrl);
  const websiteLabel = websiteUrl ? getCompactWebsiteLabel(websiteUrl) : null;
  const publicHandle = formatPublicHandle(publicIdentifier);
  const publicIdentityLine = getPublicIdentityLine(profile);
  const contextSummary =
    profile.tagline?.trim() ||
    "A premium way to connect before you share personal details.";
  const canSendRequest = hasUnlockedTrustRequirement(
    currentUser,
    "send_contact_request",
  );
  const isPrimaryCtaSettling = primaryCtaState.status === "settling";
  const shouldShowDirectActions = smartActions.length > 0;
  const isPrimaryActionDisabled =
    (primaryCtaAction === "login" ? false : resolvedPrimaryCta.isDisabled) ||
    isConnected ||
    requestSucceeded;
  const disabledMessage = isPrimaryActionDisabled
    ? `${resolvedPrimaryCta.helperText}. Try again later.`
    : null;

  function clearFeedbackTimeout() {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }

  function clearDirectActionFeedbackTimeout() {
    if (directActionFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(directActionFeedbackTimeoutRef.current);
      directActionFeedbackTimeoutRef.current = null;
    }
  }

  function setSuccessState(message: string) {
    clearFeedbackTimeout();
    setPrimaryCtaState({ status: "success", message });
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setPrimaryCtaState({ status: "idle" });
      feedbackTimeoutRef.current = null;
    }, 1800);
  }

  function setSettlingState() {
    clearFeedbackTimeout();
    setPrimaryCtaState({ status: "settling" });
  }

  function setErrorState(message: string) {
    clearFeedbackTimeout();
    setPrimaryCtaState({ status: "error", message });
  }

  function resetPrimaryFeedback() {
    clearFeedbackTimeout();
    setPrimaryCtaState({ status: "idle" });
  }

  function setDirectActionSuccessState(message: string) {
    clearDirectActionFeedbackTimeout();
    setDirectActionState({ status: "success", message });
    directActionFeedbackTimeoutRef.current = window.setTimeout(() => {
      setDirectActionState({ status: "idle" });
      directActionFeedbackTimeoutRef.current = null;
    }, 1800);
  }

  function setDirectActionErrorState(message: string) {
    clearDirectActionFeedbackTimeout();
    setDirectActionState({ status: "error", message });
  }

  function setDirectActionLoadingState() {
    clearDirectActionFeedbackTimeout();
    setDirectActionState({ status: "loading" });
  }

  function startInstantConnectMeasurement(): string | null {
    if (
      typeof performance === "undefined" ||
      typeof performance.mark !== "function" ||
      typeof performance.measure !== "function"
    ) {
      return null;
    }

    instantConnectMeasureIdRef.current += 1;
    const id = `public-smart-card-instant-connect-${publicIdentifier}-${instantConnectMeasureIdRef.current}`;

    performance.mark(`${id}-start`);

    return id;
  }

  function finishInstantConnectMeasurement(
    measurementId: string | null,
    outcome: string,
  ) {
    if (
      !measurementId ||
      typeof performance === "undefined" ||
      typeof performance.mark !== "function" ||
      typeof performance.measure !== "function"
    ) {
      return;
    }

    const endMark = `${measurementId}-${outcome}-end`;

    performance.mark(endMark);
    performance.measure(
      `public-smart-card-instant-connect:${outcome}`,
      `${measurementId}-start`,
      endMark,
    );
  }

  async function handleRequestAccessAction() {
    setRequestSucceeded(false);

    if (!isOnline) {
      setErrorState("Reconnect to send this request.");
      return;
    }

    if (!selectedPersonaId) {
      setErrorState(
        (personasLoading ? "Loading your personas..." : personaLoadError) ??
          (isAuthenticated
            ? "Dotly needs one of your Dotlys before it can send this request."
            : "Log in to request access."),
      );
      return;
    }

    try {
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      requestKeyRef.current ??= buildRequestKey(
        "request-access",
        publicIdentifier,
        selectedPersonaId,
      );

      const target =
        requestTarget ?? (await publicApi.getRequestTarget(publicIdentifier));

      setRequestTarget(target);

      await requestApi.send(
        {
          toUsername: target.username,
          fromPersonaId: selectedPersonaId,
          reason: undefined,
          sourceType: "profile",
          sourceId: null,
        },
        {
          signal: controller.signal,
          requestKey: requestKeyRef.current,
        },
      );

      requestKeyRef.current = null;
      setRequestSucceeded(true);
      setShowCustomizeOptions(false);
      setInstantConnectUiState({ status: "idle" });
      setSuccessState("Request sent ✓");
      showToast("Request sent");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorState(toFriendlyRequestMessage(error));
    }
  }

  function handleLoginAction() {
    if (!loginHref) {
      setErrorState("Log in to continue.");
      return;
    }

    setSuccessState("Opening login.");
    window.location.assign(loginHref);
  }

  function handleContactAction() {
    if (smartActions.length === 0) {
      setErrorState(
        "No direct connection options are available on this card yet.",
      );
      return;
    }

    const preferredAction = smartActions[0];

    if (!preferredAction) {
      setErrorState(
        "No direct connection options are available on this card yet.",
      );
      return;
    }

    if (preferredAction.key === "vcard") {
      void handleVcardAction(preferredAction.href);
      return;
    }

    if (preferredAction.key === "whatsapp") {
      window.open(preferredAction.href, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.assign(preferredAction.href);
  }

  async function handleInstantConnectAction() {
    if (!isOnline) {
      setErrorState("Reconnect to connect.");
      return;
    }

    if (!profile.instantConnectUrl) {
      handleRequestAccessAction();
      return;
    }

    if (!selectedPersonaId) {
      setErrorState(
        (personasLoading ? "Loading your personas..." : personaLoadError) ??
          (isAuthenticated
            ? "Dotly needs one of your Dotlys before connecting."
            : "Log in to continue."),
      );
      return;
    }

    const measurementId = startInstantConnectMeasurement();
    const previousUiState = instantConnectUiState;

    setSettlingState();
    setShowSlowNetworkHint(false);
    window.setTimeout(() => {
      setShowSlowNetworkHint((current) =>
        primaryCtaState.status === "loading" ||
        primaryCtaState.status === "settling"
          ? true
          : current,
      );
    }, 2000);

    try {
      connectAbortRef.current?.abort();
      const controller = new AbortController();
      connectAbortRef.current = controller;
      connectKeyRef.current ??= buildRequestKey(
        "instant-connect",
        publicIdentifier,
        selectedPersonaId,
      );

      await relationshipApi.instantConnect(
        publicIdentifier,
        {
          fromPersonaId: selectedPersonaId,
        },
        {
          signal: controller.signal,
          requestKey: connectKeyRef.current,
        },
      );
      connectKeyRef.current = null;
      finishInstantConnectMeasurement(measurementId, "connected");
      window.setTimeout(() => {
        setInstantConnectUiState({
          status: "connected",
          message: "Connected ✓",
        });
        setSuccessState("Connected ✓");
        showToast("Connected");
      }, 160);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (error instanceof ApiError && isAlreadyConnectedError(error)) {
        finishInstantConnectMeasurement(measurementId, "already_connected");
        setInstantConnectUiState({
          status: "connected",
          message: "Connected ✓",
        });
        setSuccessState("Connected ✓");
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        finishInstantConnectMeasurement(measurementId, "login_required");
        setInstantConnectUiState(previousUiState);
        setShowLoginCta(true);
        setErrorState(getInstantConnectErrorMessage(error));
        return;
      }

      if (error instanceof ApiError && isRestrictedConnectError(error)) {
        if (isBlockedConnectError(error)) {
          finishInstantConnectMeasurement(measurementId, "blocked");
          setInstantConnectUiState(previousUiState);
          setErrorState(getBlockedConnectMessage(error));
          return;
        }

        if (isVerificationRequiredError(error)) {
          finishInstantConnectMeasurement(
            measurementId,
            "verification_required",
          );
          setInstantConnectUiState(previousUiState);
          setErrorState(getVerificationRequiredMessage());
          return;
        }

        if (supportsInstantConnectFallback) {
          finishInstantConnectMeasurement(measurementId, "request_fallback");
          resetPrimaryFeedback();

          await handleRequestAccessAction();

          return;
        }

        finishInstantConnectMeasurement(measurementId, "forbidden");
        setInstantConnectUiState(previousUiState);
        setErrorState("This profile is not accepting connections right now.");
        return;
      }

      finishInstantConnectMeasurement(measurementId, "failed");
      setInstantConnectUiState(previousUiState);

      setErrorState(
        error instanceof ApiError
          ? getInstantConnectErrorMessage(error)
          : "Connect is unavailable right now.",
      );
    } finally {
      setShowSlowNetworkHint(false);
    }
  }

  async function handleVcardAction(href: string) {
    setIsVcardDownloading(true);
    setDirectActionLoadingState();

    try {
      await downloadVcard(href, publicIdentifier);
      showToast("Saved to contacts");
      setDirectActionSuccessState("Saved to contacts");
    } catch {
      setDirectActionErrorState("Unable to download contact.");
    } finally {
      setIsVcardDownloading(false);
    }
  }

  async function handlePrimaryAction() {
    if (isPrimaryActionDisabled || primaryCtaState.status === "loading") {
      return;
    }

    setPrimaryCtaState({ status: "loading" });

    switch (primaryCtaAction) {
      case "login":
        handleLoginAction();
        return;
      case "request_access":
        await handleRequestAccessAction();
        return;
      case "contact_me":
        handleContactAction();
        return;
      case "instant_connect":
        await handleInstantConnectAction();
        return;
    }
  }

  return (
    <SmartCardHeroShell>
      <div className="space-y-6 text-center sm:space-y-7">
        <div className="space-y-4">
          {profile.profilePhotoUrl ? (
            <ExternalImage
              src={profile.profilePhotoUrl}
              alt={profile.fullName}
              width={128}
              height={128}
              sizes="(max-width: 640px) 112px, 128px"
              priority
              className="mx-auto h-28 w-28 rounded-full object-cover shadow-[0_24px_54px_rgba(15,23,42,0.18)] ring-4 ring-white/90 sm:h-32 sm:w-32 dark:ring-white/10"
            />
          ) : (
            <div
              className="mx-auto flex h-28 w-28 items-center justify-center rounded-full text-[1.95rem] font-semibold text-white shadow-[0_24px_54px_rgba(15,23,42,0.2)] ring-4 ring-white/85 sm:h-32 sm:w-32 sm:text-[2.2rem] dark:ring-white/10"
              style={{
                background: `linear-gradient(135deg, hsl(${hue}, 68%, 54%), hsl(${(hue + 28) % 360}, 72%, 48%))`,
              }}
            >
              {profile.fullName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {profile.isVerified !== false ? (
                <SmartCardTrustBadge trust={profile.trust} />
              ) : null}
            </div>
            <h1 className="text-[2.2rem] font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-[2.5rem]">
              {publicHandle}
            </h1>
            {publicIdentityLine ? (
              <p className="mx-auto max-w-[30ch] text-sm font-medium leading-6 text-muted/90 sm:text-[15px]">
                {publicIdentityLine}
              </p>
            ) : null}
            {trimmedTagline ? (
              <p
                className="mx-auto max-w-[31ch] text-sm leading-6 text-muted/95 line-clamp-2 sm:text-[15px]"
                title={trimmedTagline}
              >
                {trimmedTagline}
              </p>
            ) : null}
            {(trimmedCompanyName || websiteUrl) && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {trimmedCompanyName ? (
                  <span className="inline-flex items-center rounded-full border border-black/8 bg-black/[0.03] px-3 py-1.5 text-xs font-medium tracking-[0.01em] text-foreground/72 dark:border-white/10 dark:bg-white/[0.045] dark:text-white/72">
                    {trimmedCompanyName}
                  </span>
                ) : null}
                {websiteUrl && websiteLabel ? (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/78 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-black/16 hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white/88 dark:hover:border-white/20 dark:hover:bg-white/[0.08]"
                  >
                    <span>Website</span>
                    <span className="max-w-[16ch] truncate text-muted">
                      {websiteLabel}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
                  </a>
                ) : null}
              </div>
            )}
            {!trimmedTagline ? (
              <p className="mx-auto max-w-[28ch] text-[13px] leading-6 text-muted">
                {cardActionSummary}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <PrimaryButton
            fullWidth
            size="lg"
            className="h-16 rounded-[22px] text-base font-semibold shadow-[0_22px_50px_rgba(15,23,42,0.14)] dark:shadow-[0_20px_46px_rgba(0,0,0,0.34)]"
            isLoading={primaryCtaState.status === "loading"}
            isSuccess={
              primaryCtaState.status === "success" ||
              isPrimaryCtaSettling ||
              isConnected
            }
            disabled={isPrimaryActionDisabled}
            loadingLabel={
              primaryCtaAction === "instant_connect"
                ? "Connecting..."
                : undefined
            }
            onClick={() => {
              void handlePrimaryAction();
            }}
          >
            {isPrimaryCtaSettling ? (
              <>
                Connected <Check className="ml-1 inline h-4 w-4" />
              </>
            ) : (
              primaryCtaLabel
            )}
          </PrimaryButton>

          {contextSummary && !profile.tagline ? (
            <p className="text-sm leading-6 text-muted">{contextSummary}</p>
          ) : null}

          {disabledMessage ? (
            <p className="text-sm leading-6 text-muted">{disabledMessage}</p>
          ) : null}
          {primaryCtaState.status === "error" ? (
            <p
              role="alert"
              className="text-sm leading-6 text-rose-500 dark:text-rose-300"
            >
              {primaryCtaState.message}
            </p>
          ) : null}
          {isConnected ? (
            <p aria-live="polite" className="text-sm leading-6 text-muted">
              {instantConnectUiState.message}
            </p>
          ) : null}
          {isPrimaryCtaSettling ? (
            <p aria-live="polite" className="text-sm leading-6 text-muted">
              Connecting...
            </p>
          ) : null}
          {primaryCtaState.status === "success" ? (
            <p aria-live="polite" className="text-sm leading-6 text-muted">
              {primaryCtaState.message}
            </p>
          ) : null}
          {showSlowNetworkHint ? (
            <p className="text-sm leading-6 text-muted">
              Still working. Keep this screen open.
            </p>
          ) : null}
          {!isOnline ? (
            <p className="text-sm leading-6 text-amber-700 dark:text-amber-300">
              You are offline.
            </p>
          ) : null}

          {hasAlternatePersonaChoice ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowCustomizeOptions((current) => !current)}
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {showCustomizeOptions ? "Keep this Dotly" : "Choose Dotly"}
              </button>
            </div>
          ) : null}

          {showCustomizeOptions && hasAlternatePersonaChoice ? (
            <div className="space-y-2 text-left">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                {primaryCtaAction === "request_access"
                  ? "Request from"
                  : "Connect from"}
              </p>
              {selectedPersona ? (
                <div className="rounded-[24px] bg-white/50 backdrop-blur-md px-4 py-3.5 ring-1 ring-inset ring-black/5 dark:bg-zinc-800/50 dark:ring-white/10">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {selectedPersona.fullName}
                  </p>
                  <p className="truncate font-mono text-xs text-muted">
                    {getPersonaPublicHandle(selectedPersona)}
                  </p>
                </div>
              ) : null}
              <select
                id="instant-connect-from-persona"
                value={selectedPersonaId}
                onChange={(event) => {
                  setSelectedPersonaId(event.target.value);
                  setShowCustomizeOptions(false);
                }}
                className="w-full rounded-[24px] bg-white/50 backdrop-blur-md px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-black/5 outline-none transition focus:bg-white/60 focus:ring-2 focus:ring-foreground/15 dark:bg-zinc-800/50 dark:ring-white/10 dark:focus:bg-zinc-800/70"
              >
                {initialPersonas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.fullName} {getPersonaPublicHandle(persona)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isAuthenticated &&
          personasLoading &&
          !hasPersonaSelection &&
          primaryAction === "instant_connect" ? (
            <p className="text-sm leading-6 text-muted">
              Loading your personas...
            </p>
          ) : null}

          {isAuthenticated &&
          displayedPrimaryAction === "request_access" &&
          currentUser &&
          !canSendRequest ? (
            <VerificationPrompt
              email={currentUser.email}
              title="Verify before sending requests"
              description={`Dotly sends curated requests only from verified accounts before introducing you to ${profile.fullName}.`}
              compact
            />
          ) : null}

          {shouldShowDirectActions ? (
            <div className="space-y-2">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowDirectActions((current) => !current)}
                  className="text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  {showDirectActions
                    ? "Hide connection options"
                    : "More ways to connect"}
                </button>
              </div>

              {directActionState.status === "error" ? (
                <p className="text-sm leading-6 text-rose-500 dark:text-rose-300">
                  {directActionState.message}
                </p>
              ) : null}
              {directActionState.status === "success" ? (
                <p aria-live="polite" className="text-sm leading-6 text-muted">
                  {directActionState.message}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {shouldShowDirectActions && showDirectActions ? (
          <div className="space-y-3">
            <div
              data-testid="smart-card-actions-grid"
              data-action-count={smartActions.length}
              className="grid grid-cols-2 gap-3"
            >
              {smartActions.map((action) => {
                const Icon = action.icon;
                const isDownloadAction = action.key === "vcard";
                const actionLabel =
                  isDownloadAction && isVcardDownloading
                    ? "Saving..."
                    : action.label;
                const actionClassName = cn(
                  "flex min-h-[88px] items-center justify-center rounded-[24px] bg-white/50 backdrop-blur-md px-3 py-4 text-center ring-1 ring-inset ring-black/5 transition-all duration-500 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] dark:bg-zinc-800/50 dark:ring-white/10 dark:focus-visible:ring-offset-black",
                  "hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28)]",
                );

                if (!isDownloadAction) {
                  return (
                    <a
                      key={action.key}
                      href={action.href}
                      target={action.key === "whatsapp" ? "_blank" : undefined}
                      rel={action.key === "whatsapp" ? "noreferrer" : undefined}
                      aria-label={action.label}
                      className={cn(actionClassName, "tap-feedback")}
                      data-tap-feedback="true"
                    >
                      <span className="flex flex-col items-center gap-2">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.045] text-foreground dark:bg-white/[0.08] dark:text-white">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {actionLabel}
                        </span>
                      </span>
                    </a>
                  );
                }

                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => {
                      void handleVcardAction(action.href);
                    }}
                    disabled={isVcardDownloading}
                    aria-busy={isVcardDownloading}
                    aria-label={action.label}
                    className={cn(
                      actionClassName,
                      "tap-feedback",
                      isVcardDownloading &&
                        "cursor-wait opacity-70 hover:translate-y-0",
                    )}
                  >
                    <span className="flex flex-col items-center gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.045] text-foreground dark:bg-white/[0.08] dark:text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {actionLabel}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {directActionState.status === "error" ? (
              <p
                role="alert"
                className="text-sm leading-6 text-rose-500 dark:text-rose-300"
              >
                {directActionState.message}
              </p>
            ) : null}
            {directActionState.status === "loading" ? (
              <p aria-live="polite" className="text-sm leading-6 text-muted">
                Saving contact card...
              </p>
            ) : null}
            {directActionState.status === "success" ? (
              <p aria-live="polite" className="text-sm leading-6 text-muted">
                {directActionState.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </SmartCardHeroShell>
  );
}
