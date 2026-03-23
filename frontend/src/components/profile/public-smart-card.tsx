"use client";

import { useEffect, useRef, useState } from "react";

import {
  AtSign,
  Check,
  Download,
  MessageCircle,
  Phone,
  Repeat2,
} from "lucide-react";

import { Card } from "@/components/shared/card";
import { VerificationPrompt } from "@/components/auth/verification-prompt";
import { PrimaryButton } from "@/components/shared/primary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { publicApi, relationshipApi, requestApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { resolvePreferredPersonaId } from "@/lib/persona/default-persona";
import { getPublicTrustPresentation } from "@/lib/persona/public-trust";
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
      return "Log in to continue";
    case "request_access":
      return "Request Access";
    case "instant_connect":
      return "Connect";
    case "contact_me":
      return "Contact";
  }
}

function getCardActionSummary(
  primaryAction: PersonaSmartCardPrimaryAction,
  fullName: string,
): string {
  switch (primaryAction) {
    case "request_access":
      return `Ask ${fullName} for access when you want a more intentional intro.`;
    case "instant_connect":
      return "Connect now and save this introduction right away.";
    case "contact_me":
      return "Use one of the direct actions below to reach out right away.";
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
      return "Log in to send a request from one of your personas.";
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
        return "You cannot contact this user.";
      }

      return "This profile is not accepting requests right now.";
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
  return "This smart card requires a verified email or mobile verification.";
}

function getRequestFallbackMessage(error: ApiError): string {
  const message = error.message.toLowerCase();

  if (message.includes("private") || message.includes("not accepting")) {
    return "Instant connect is not available here. Request access instead.";
  }

  return "Instant connect is not available here. Request access instead.";
}

function getInstantConnectErrorMessage(error: ApiError): string {
  if (error.status === 401) {
    return "Log in to connect.";
  }

  if (error.status === 429) {
    return "Please wait a moment and try again.";
  }

  return "Couldn't connect right now. Try again.";
}

function SmartCardHeroShell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden border-border/50 bg-white/95 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:bg-surface1/95 dark:shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
      <div className="relative overflow-hidden px-5 py-6 sm:px-6 sm:py-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(255,255,255,0.72)_45%,rgba(248,250,252,0.94)_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(17,24,39,0.96),rgba(15,23,42,0.9)_48%,rgba(2,6,23,0.96)_100%)]" />
        <div className="absolute inset-x-10 top-0 h-28 rounded-full bg-brandRose/10 blur-3xl dark:bg-brandCyan/12" />
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
  const config = profile.smartCard;
  const [isContactPanelHighlighted, setIsContactPanelHighlighted] =
    useState(false);
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
  const [isVcardDownloading, setIsVcardDownloading] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestTarget, setRequestTarget] =
    useState<PublicProfileRequestTarget | null>(null);
  const [requestState, setRequestState] = useState<{
    status: "idle" | "submitting" | "success" | "error";
    message: string | null;
  }>({ status: "idle", message: null });
  const [showPersonaOptions, setShowPersonaOptions] = useState(false);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const directActionFeedbackTimeoutRef = useRef<number | null>(null);
  const panelHighlightTimeoutRef = useRef<number | null>(null);
  const contactPanelRef = useRef<HTMLDivElement | null>(null);
  const instantConnectMeasureIdRef = useRef(0);

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
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }

      if (directActionFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(directActionFeedbackTimeoutRef.current);
      }

      if (panelHighlightTimeoutRef.current !== null) {
        window.clearTimeout(panelHighlightTimeoutRef.current);
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

  const hue = avatarHue(profile.username);
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
      label: "Save",
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
  const isFallback = instantConnectUiState.status === "fallback";
  const hasPersonaSelection = initialPersonas.length > 0;
  const hasMultiplePersonas = initialPersonas.length > 1;
  const selectedPersona = initialPersonas.find(
    (persona) => persona.id === selectedPersonaId,
  );
  const displayedPrimaryAction = isFallback ? "request_access" : primaryAction;
  const primaryCtaAction =
    showLoginCta && displayedPrimaryAction !== "contact_me"
      ? "login"
      : displayedPrimaryAction;
  const primaryCtaLabel = isConnected
    ? "Connected"
    : getPrimaryCtaLabel(primaryCtaAction);
  const trustPresentation = getPublicTrustPresentation(profile.trust);
  const cardActionSummary = getCardActionSummary(
    displayedPrimaryAction,
    profile.fullName,
  );
  const contextSummary =
    profile.tagline?.trim() || dotlyPositioning.shortExplainer;
  const selectedPersonaSummary = selectedPersona
    ? `Connecting as ${selectedPersona.fullName}`
    : null;
  const canSendRequest = hasUnlockedTrustRequirement(
    currentUser,
    "send_contact_request",
  );
  const canShowInlineRequest =
    displayedPrimaryAction === "request_access" || isFallback;
  const requestButtonLabel =
    requestState.status === "success" ? "Request Sent" : "Request Access";
  const requestButtonDisabled =
    requestState.status === "submitting" || requestState.status === "success";
  const isPrimaryCtaSettling = primaryCtaState.status === "settling";
  const requestPanelDescription = isFallback
    ? "Instant connect is unavailable here, so Dotly is ready to send a request from your default persona instead."
    : `Request access from ${selectedPersona?.fullName ?? "your default persona"} without leaving this card.`;

  const shouldShowDirectActions = smartActions.length > 0;
  const isPrimaryActionDisabled =
    (primaryCtaAction === "login" ? false : resolvedPrimaryCta.isDisabled) ||
    isConnected;
  const fallbackMessage = resolvedPrimaryCta.isFallback
    ? `Showing ${getPrimaryCtaLabel(primaryAction)} right now.`
    : null;
  const disabledMessage = isPrimaryActionDisabled
    ? `${resolvedPrimaryCta.helperText}. Try again later.`
    : null;

  function clearFeedbackTimeout() {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }

  function clearPanelHighlightTimeout() {
    if (panelHighlightTimeoutRef.current !== null) {
      window.clearTimeout(panelHighlightTimeoutRef.current);
      panelHighlightTimeoutRef.current = null;
    }
  }

  function clearDirectActionFeedbackTimeout() {
    if (directActionFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(directActionFeedbackTimeoutRef.current);
      directActionFeedbackTimeoutRef.current = null;
    }
  }

  function highlightContactPanel() {
    clearPanelHighlightTimeout();
    setIsContactPanelHighlighted(true);
    panelHighlightTimeoutRef.current = window.setTimeout(() => {
      setIsContactPanelHighlighted(false);
      panelHighlightTimeoutRef.current = null;
    }, 1800);
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
    }, 2200);
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
    const id = `public-smart-card-instant-connect-${profile.username}-${instantConnectMeasureIdRef.current}`;

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

  function getRequestAccessTarget(): HTMLElement | null {
    if (!requestAccessHref.startsWith("#")) {
      return null;
    }

    const targetId = requestAccessHref.slice(1);

    return targetId ? document.getElementById(targetId) : null;
  }

  function focusRequestAccessTarget(): boolean {
    const target = getRequestAccessTarget();

    if (!target) {
      return false;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.focus();

    return true;
  }

  function handleRequestAccessAction() {
    setRequestState({ status: "idle", message: null });

    if (!requestAccessHref.startsWith("#")) {
      setInstantConnectUiState({
        status: "fallback",
        message: "Request access is ready.",
      });
      setSuccessState("Opening request access.");
      window.location.assign(requestAccessHref);
      return;
    }

    if (!focusRequestAccessTarget()) {
      setErrorState("Request access is unavailable right now.");
      return;
    }

    setInstantConnectUiState({
      status: "fallback",
      message: "Request access is ready below.",
    });
    setSuccessState("Request form ready below.");
  }

  async function handleInlineRequestAccess() {
    if (!selectedPersonaId) {
      setRequestState({
        status: "error",
        message: "Choose one of your personas before sending the request.",
      });
      return;
    }

    setRequestState({ status: "submitting", message: null });

    try {
      const target =
        requestTarget ?? (await publicApi.getRequestTarget(profile.username));

      setRequestTarget(target);

      await requestApi.send({
        toUsername: target.username,
        fromPersonaId: selectedPersonaId,
        reason: requestReason.trim() || undefined,
        sourceType: "profile",
        sourceId: null,
      });

      setRequestState({
        status: "success",
        message: "Request sent. They will see who you are and how you met.",
      });
      showToast("Request sent");
    } catch (error) {
      setRequestState({
        status: "error",
        message: toFriendlyRequestMessage(error),
      });
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
        "No direct contact actions are available on this card yet.",
      );
      return;
    }

    highlightContactPanel();
    contactPanelRef.current?.focus();
    setSuccessState("Choose a direct way to reach out below.");
  }

  async function handleInstantConnectAction() {
    if (!profile.instantConnectUrl) {
      handleRequestAccessAction();
      return;
    }

    if (!selectedPersonaId) {
      setErrorState(
        (personasLoading ? "Loading your personas..." : personaLoadError) ??
          (isAuthenticated
            ? "Choose one of your personas before connecting."
            : "Log in to continue."),
      );
      return;
    }

    const measurementId = startInstantConnectMeasurement();
    const previousUiState = instantConnectUiState;

    setSettlingState();

    try {
      const result = await relationshipApi.instantConnect(profile.username, {
        fromPersonaId: selectedPersonaId,
      });
      finishInstantConnectMeasurement(measurementId, "connected");
      window.setTimeout(() => {
        setInstantConnectUiState({
          status: "connected",
          message:
            result.status === "connected" ? "Connected instantly" : "Connected",
        });
        setSuccessState("Connection saved.");
        showToast("Connected");
      }, 220);
    } catch (error) {
      if (error instanceof ApiError && isAlreadyConnectedError(error)) {
        finishInstantConnectMeasurement(measurementId, "already_connected");
        setInstantConnectUiState({
          status: "connected",
          message: "Already connected",
        });
        setSuccessState("Already connected.");
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
          setInstantConnectUiState({
            status: "fallback",
            message: getRequestFallbackMessage(error),
          });
          resetPrimaryFeedback();

          if (!focusRequestAccessTarget()) {
            setErrorState("Request access is unavailable right now.");
          }

          return;
        }

        finishInstantConnectMeasurement(measurementId, "forbidden");
        setInstantConnectUiState(previousUiState);
        setErrorState(
          "This profile is not accepting instant connections right now.",
        );
        return;
      }

      finishInstantConnectMeasurement(measurementId, "failed");
      setInstantConnectUiState(previousUiState);

      setErrorState(
        error instanceof ApiError
          ? getInstantConnectErrorMessage(error)
          : "Instant Connect is unavailable right now.",
      );
    }
  }

  async function handleVcardAction(href: string) {
    setIsVcardDownloading(true);
    setDirectActionLoadingState();

    try {
      await downloadVcard(href, profile.username);
      showToast("Contact saved");
      setDirectActionSuccessState("Contact saved.");
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
        handleRequestAccessAction();
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profilePhotoUrl}
              alt={profile.fullName}
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
              <span className="inline-flex items-center rounded-full border border-black/8 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/72 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/72">
                Next step
              </span>
              <SmartCardTrustBadge trust={profile.trust} />
            </div>
            <h1 className="text-[2.2rem] font-semibold leading-none tracking-tight text-foreground sm:text-[2.5rem]">
              {profile.fullName}
            </h1>
            <p className="mx-auto max-w-[28ch] text-[15px] leading-7 text-muted">
              {cardActionSummary}
            </p>
            {trustPresentation ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                {dotlyPositioning.publicProfile.verifiedLabel}
              </p>
            ) : null}
            {(profile.jobTitle || profile.companyName) && (
              <p className="text-sm font-medium leading-5 text-foreground/72 sm:text-base">
                {[profile.jobTitle, profile.companyName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {profile.tagline ? (
              <p
                className="mx-auto max-w-[30ch] text-sm leading-7 text-muted line-clamp-2"
                title={profile.tagline}
              >
                {profile.tagline}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <PrimaryButton
            fullWidth
            size="lg"
            className="h-16 rounded-[22px] text-base font-semibold shadow-[0_22px_50px_rgba(244,63,94,0.24)] dark:shadow-[0_20px_46px_rgba(34,211,238,0.22)]"
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
            {isPrimaryCtaSettling ? "Connected" : primaryCtaLabel}
          </PrimaryButton>

          {contextSummary && !profile.tagline ? (
            <p className="text-sm leading-6 text-muted">{contextSummary}</p>
          ) : null}

          {fallbackMessage ? (
            <p className="text-sm leading-6 text-muted">{fallbackMessage}</p>
          ) : null}
          {disabledMessage ? (
            <p className="text-sm leading-6 text-muted">{disabledMessage}</p>
          ) : null}
          {isFallback && primaryCtaState.status !== "success" ? (
            <p
              role="alert"
              className="text-sm leading-6 text-rose-500 dark:text-rose-300"
            >
              {instantConnectUiState.message}
            </p>
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
              Finalizing your connection...
            </p>
          ) : null}
          {isFallback ? (
            <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/6 px-4 py-3 text-left">
              <p className="text-sm font-semibold text-foreground">
                Request Access
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {instantConnectUiState.message}
              </p>
            </div>
          ) : null}
          {primaryCtaState.status === "success" ? (
            <p aria-live="polite" className="text-sm leading-6 text-muted">
              {primaryCtaState.message}
            </p>
          ) : null}

          {isAuthenticated && hasMultiplePersonas ? (
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Connecting as
                </p>
                <button
                  type="button"
                  onClick={() => setShowPersonaOptions((current) => !current)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-foreground"
                >
                  <Repeat2 className="h-3.5 w-3.5" />
                  Change
                </button>
              </div>
              {selectedPersona ? (
                <div className="rounded-[1.35rem] border border-black/8 bg-white/82 px-4 py-3.5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {selectedPersona.fullName}
                  </p>
                  <p className="truncate font-mono text-xs text-muted">
                    @{selectedPersona.username}
                  </p>
                </div>
              ) : null}
              {showPersonaOptions ? (
                <select
                  id="instant-connect-from-persona"
                  value={selectedPersonaId}
                  onChange={(event) => {
                    setSelectedPersonaId(event.target.value);
                    setShowPersonaOptions(false);
                  }}
                  className="w-full rounded-[20px] border border-black/8 bg-white/82 px-4 py-3 text-sm text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.05)] outline-none transition focus:border-brandRose/35 dark:border-white/10 dark:bg-white/[0.04] dark:focus:border-brandCyan/35 dark:shadow-none"
                >
                  {initialPersonas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.fullName} @{persona.username}
                    </option>
                  ))}
                </select>
              ) : null}
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
          hasPersonaSelection &&
          !hasMultiplePersonas &&
          selectedPersona ? (
            <p className="text-sm leading-6 text-muted">
              {selectedPersonaSummary}
            </p>
          ) : null}

          {canShowInlineRequest ? (
            <Card className="border-black/6 bg-white/72 text-left shadow-[0_18px_46px_rgba(15,23,42,0.08)] dark:border-white/8 dark:bg-white/[0.03] dark:shadow-none">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Request access
                  </p>
                  <h2 className="text-[1.05rem] font-semibold tracking-tight text-foreground">
                    Continue without leaving this card
                  </h2>
                  <p className="text-sm leading-7 text-muted">
                    {requestPanelDescription}
                  </p>
                </div>

                {!isAuthenticated ? (
                  <p className="text-sm leading-6 text-muted">
                    Log in to request access.
                  </p>
                ) : currentUser && !canSendRequest ? (
                  <VerificationPrompt
                    email={currentUser.email}
                    title="Verify before sending requests"
                    description={`Dotly sends requests only from verified accounts before introducing you to ${profile.fullName}.`}
                    compact
                  />
                ) : !hasPersonaSelection ? (
                  <p className="text-sm leading-6 text-muted">
                    {personasLoading
                      ? "Loading your personas..."
                      : "Create a persona to request access from this card."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="inline-request-reason"
                        className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
                      >
                        Add context
                      </label>
                      <textarea
                        id="inline-request-reason"
                        maxLength={280}
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted/50 focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
                        placeholder="Remind them how you met (optional)"
                        value={requestReason}
                        onChange={(event) =>
                          setRequestReason(event.target.value)
                        }
                        disabled={requestButtonDisabled}
                      />
                    </div>

                    {requestState.message ? (
                      <p
                        className={cn(
                          "text-sm leading-6",
                          requestState.status === "error"
                            ? "text-rose-500 dark:text-rose-300"
                            : "text-muted",
                        )}
                      >
                        {requestState.message}
                      </p>
                    ) : null}

                    <PrimaryButton
                      fullWidth
                      type="button"
                      isLoading={requestState.status === "submitting"}
                      isSuccess={requestState.status === "success"}
                      disabled={requestButtonDisabled}
                      onClick={() => {
                        void handleInlineRequestAccess();
                      }}
                    >
                      {requestButtonLabel}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            </Card>
          ) : null}
        </div>

        {shouldShowDirectActions ? (
          <div className="space-y-3">
            <div
              ref={contactPanelRef}
              tabIndex={-1}
              data-testid="smart-card-actions-grid"
              data-action-count={smartActions.length}
              className={cn(
                "grid grid-cols-2 gap-3 outline-none",
                isContactPanelHighlighted && "scale-[1.01]",
              )}
            >
              {smartActions.map((action) => {
                const Icon = action.icon;
                const isDownloadAction = action.key === "vcard";
                const actionLabel =
                  isDownloadAction && isVcardDownloading
                    ? "Saving..."
                    : action.label;
                const actionClassName = cn(
                  "flex min-h-[88px] items-center justify-center rounded-[22px] border border-black/6 bg-white/88 px-3 py-4 text-center transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandRose/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] dark:border-white/8 dark:bg-white/[0.04] dark:focus-visible:ring-brandCyan/35 dark:focus-visible:ring-offset-surface1",
                  "hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28)]",
                  isContactPanelHighlighted &&
                    "border-brandRose/20 bg-brandRose/[0.06] dark:border-brandCyan/20 dark:bg-brandCyan/[0.08]",
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
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brandRose/10 text-brandRose dark:bg-brandCyan/12 dark:text-brandCyan">
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
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brandRose/10 text-brandRose dark:bg-brandCyan/12 dark:text-brandCyan">
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
                Starting contact download...
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
