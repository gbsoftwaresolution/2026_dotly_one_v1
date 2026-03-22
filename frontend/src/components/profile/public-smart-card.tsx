"use client";

import { useEffect, useRef, useState } from "react";

import {
  ArrowRight,
  AtSign,
  Download,
  ExternalLink,
  MessageCircle,
  Phone,
  QrCode,
} from "lucide-react";

import { Card } from "@/components/shared/card";
import { PrimaryButton } from "@/components/shared/primary-button";
import { formatPrimaryAction } from "@/lib/persona/labels";
import {
  getPublicSmartCardActionLinks,
  getPublicSmartCardDirectActions,
  hasPublicSmartCardDirectActions,
  resolvePublicSmartCardPrimaryCta,
} from "@/lib/persona/smart-card";
import { cn } from "@/lib/utils/cn";
import type {
  PersonaSmartCardPrimaryAction,
  PublicProfile,
} from "@/types/persona";

interface PublicSmartCardProps {
  profile: PublicProfile;
  requestAccessHref?: string;
}

interface SmartAction {
  key: "call" | "whatsapp" | "email" | "vcard";
  label: string;
  href: string;
  icon: typeof Phone;
}

function getActionPanelCopy(actions: SmartAction[]): {
  badge: string;
  description: string;
} {
  const actionCount = actions.length;
  const hasDirectChannel = actions.some((action) => action.key !== "vcard");
  const hasSaveContact = actions.some((action) => action.key === "vcard");

  if (hasSaveContact && !hasDirectChannel) {
    return {
      badge: actionCount === 1 ? "1 action available" : `${actionCount} actions available`,
      description: "Save this contact to your device for later.",
    };
  }

  if (hasDirectChannel && hasSaveContact) {
    return {
      badge: `${actionCount} actions available`,
      description: "Reach out now or save this contact for later.",
    };
  }

  if (actionCount === 1) {
    return {
      badge: "1 action available",
      description: "Use the available public channel to get in touch.",
    };
  }

  return {
    badge: `${actionCount} actions available`,
    description: "Choose the fastest public channel for this conversation.",
  };
}

function getActionGridClassName(actionCount: number): string {
  if (actionCount <= 1) {
    return "grid-cols-1";
  }

  if (actionCount === 2) {
    return "grid-cols-1 min-[360px]:grid-cols-2";
  }

  return "grid-cols-1 min-[420px]:grid-cols-2";
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
  const safeFilename = username.trim().replace(/[^a-z0-9_-]+/gi, "-") || "contact";

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

function getPrimaryCtaCopy(primaryAction: PersonaSmartCardPrimaryAction): {
  label: string;
  icon: typeof ArrowRight;
} {
  switch (primaryAction) {
    case "request_access":
      return { label: "Request Access", icon: ArrowRight };
    case "instant_connect":
      return { label: "Connect Instantly", icon: QrCode };
    case "contact_me":
      return { label: "Contact", icon: ArrowRight };
  }
}

type PrimaryCtaState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type DirectActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function PublicSmartCard({
  profile,
  requestAccessHref = "#request-access-panel",
}: PublicSmartCardProps) {
  const config = profile.smartCard;
  const [isContactPanelHighlighted, setIsContactPanelHighlighted] =
    useState(false);
  const [primaryCtaState, setPrimaryCtaState] = useState<PrimaryCtaState>({
    status: "idle",
  });
  const [directActionState, setDirectActionState] = useState<DirectActionState>({
    status: "idle",
  });
  const [isVcardDownloading, setIsVcardDownloading] = useState(false);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const directActionFeedbackTimeoutRef = useRef<number | null>(null);
  const panelHighlightTimeoutRef = useRef<number | null>(null);
  const contactPanelRef = useRef<HTMLDivElement | null>(null);

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
      <Card className="overflow-hidden border-amber-300/50 bg-amber-50/90 p-0 dark:border-status-warning/25 dark:bg-status-warning/10">
        <div className="space-y-3 px-6 py-6">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-700 dark:text-status-warning">
            Smart Card unavailable
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            This Smart Card is missing its public configuration
          </h1>
          <p className="text-sm leading-6 text-muted">
            The owner enabled Smart Card mode, but there is no usable public
            card setup yet.
          </p>
        </div>
      </Card>
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
      label: "Save Contact",
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
  const primaryCta = getPrimaryCtaCopy(primaryAction);
  const PrimaryIcon = primaryCta.icon;
  const requestedPrimaryActionLabel = formatPrimaryAction(
    resolvedPrimaryCta.requestedAction,
  );
  const effectivePrimaryActionLabel = formatPrimaryAction(primaryAction);
  const primarySummary = resolvedPrimaryCta.isDisabled
    ? `${requestedPrimaryActionLabel} is unavailable right now.`
    : resolvedPrimaryCta.isFallback
      ? `${requestedPrimaryActionLabel} is unavailable. Showing ${effectivePrimaryActionLabel} instead.`
      : primaryAction === "request_access"
        ? "Request approval to continue."
        : primaryAction === "instant_connect"
          ? "Continue instantly from this card."
          : "Choose a direct way to reach out.";

  const shouldShowDirectActions = smartActions.length > 0;
  const isPrimaryActionDisabled = resolvedPrimaryCta.isDisabled;
  const actionPanelCopy = getActionPanelCopy(smartActions);
  const actionGridClassName = getActionGridClassName(smartActions.length);

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

  function setErrorState(message: string) {
    clearFeedbackTimeout();
    setPrimaryCtaState({ status: "error", message });
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

  function handleRequestAccessAction() {
    if (!requestAccessHref.startsWith("#")) {
      setSuccessState("Opening request access.");
      window.location.assign(requestAccessHref);
      return;
    }

    const targetId = requestAccessHref.slice(1);
    const target = targetId ? document.getElementById(targetId) : null;

    if (!target) {
      setErrorState("Request access is unavailable right now.");
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setSuccessState("Request access is ready below.");
  }

  function handleContactAction() {
    if (smartActions.length === 0) {
      setErrorState("No direct contact actions are available on this card yet.");
      return;
    }

    highlightContactPanel();
    window.requestAnimationFrame(() => {
      contactPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    setSuccessState("Direct contact is ready below.");
  }

  function handleInstantConnectAction() {
    if (!profile.instantConnectUrl) {
      handleRequestAccessAction();
      return;
    }

    try {
      window.location.assign(profile.instantConnectUrl);
    } catch {
      setErrorState("Instant Connect is unavailable right now.");
    }
  }

  async function handleVcardAction(href: string) {
    setIsVcardDownloading(true);
    setDirectActionLoadingState();

    try {
      await downloadVcard(href, profile.username);
      setDirectActionSuccessState("Contact download started.");
    } catch {
      setDirectActionErrorState("Unable to download contact.");
    } finally {
      setIsVcardDownloading(false);
    }
  }

  function handlePrimaryAction() {
    if (isPrimaryActionDisabled) {
      return;
    }

    setPrimaryCtaState({ status: "loading" });

    switch (primaryAction) {
      case "request_access":
        handleRequestAccessAction();
        return;
      case "contact_me":
        handleContactAction();
        return;
      case "instant_connect":
        handleInstantConnectAction();
        return;
    }
  }

  return (
    <Card className="overflow-hidden p-0 shadow-shell border-border/60">
      <div
        className="relative overflow-hidden px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7"
        style={{
          background: `radial-gradient(circle at top right, hsla(${(hue + 28) % 360}, 90%, 72%, 0.24), transparent 34%), linear-gradient(160deg, hsl(${hue}, 56%, 13%) 0%, hsl(${(hue + 22) % 360}, 48%, 11%) 46%, hsl(${(hue + 58) % 360}, 44%, 9%) 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_42%)]" />

        <div className="relative space-y-5 sm:space-y-6">
          <div className="flex items-start gap-3.5 sm:gap-4">
            {profile.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profilePhotoUrl}
                alt={profile.fullName}
                className="h-16 w-16 rounded-[22px] object-cover ring-1 ring-white/20 sm:h-20 sm:w-20 sm:rounded-[26px]"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-[22px] text-xl font-bold text-white ring-1 ring-white/20 sm:h-20 sm:w-20 sm:rounded-[26px] sm:text-2xl"
                style={{ background: `hsl(${hue}, 58%, 44%)` }}
              >
                {profile.fullName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <div className="space-y-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">
                  Smart Card
                </p>
                <h1 className="text-[1.75rem] font-black leading-none tracking-tight text-white sm:text-[2rem]">
                  {profile.fullName}
                </h1>
              </div>

              <div className="space-y-1 text-white/78">
                {(profile.jobTitle || profile.companyName) && (
                  <p className="text-sm font-medium leading-5">
                    {[profile.jobTitle, profile.companyName]
                      .filter(Boolean)
                      .join(" at ")}
                  </p>
                )}
                {profile.tagline ? (
                  <p className="max-w-[28ch] text-sm leading-6 text-white/70">
                    {profile.tagline}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/12 bg-white/[0.08] p-3.5 backdrop-blur-sm sm:p-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">
                  Primary action
                </p>
                <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/78">
                  {resolvedPrimaryCta.helperText}
                </span>
                {resolvedPrimaryCta.isFallback ? (
                  <span className="rounded-full border border-amber-300/35 bg-amber-300/12 px-3 py-1 text-[11px] font-semibold text-amber-100">
                    Fallback shown
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-6 text-white/72">
                {primarySummary}
              </p>
            </div>

            <div className="pt-4">
              <PrimaryButton
                className="h-16 w-full gap-3 rounded-[24px] text-base sm:h-[68px]"
                isLoading={primaryCtaState.status === "loading"}
                isSuccess={primaryCtaState.status === "success"}
                disabled={isPrimaryActionDisabled}
                onClick={handlePrimaryAction}
              >
                {primaryCtaState.status === "loading" ? null : (
                  <PrimaryIcon className="h-5 w-5" />
                )}
                {primaryCta.label}
              </PrimaryButton>
              {isPrimaryActionDisabled ? (
                <p className="pt-3 text-sm leading-6 text-white/72">
                  {resolvedPrimaryCta.helperText}. Try again later.
                </p>
              ) : null}
              {primaryCtaState.status === "error" ? (
                <p role="alert" className="pt-3 text-sm leading-6 text-rose-200">
                  {primaryCtaState.message}
                </p>
              ) : null}
              {primaryCtaState.status === "success" ? (
                <p aria-live="polite" className="pt-3 text-sm leading-6 text-white/72">
                  {primaryCtaState.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        {shouldShowDirectActions ? (
          <div
            ref={contactPanelRef}
            className={cn(
              "space-y-3 rounded-[24px] border border-border bg-surface/60 p-3.5 transition-colors sm:p-4",
              isContactPanelHighlighted &&
                "border-brandRose/35 bg-brandRose/5 dark:border-brandCyan/35 dark:bg-brandCyan/10",
            )}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
                  Quick actions
                </p>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted">
                  {actionPanelCopy.badge}
                </span>
              </div>
              <p className="text-sm leading-6 text-muted">
                {actionPanelCopy.description}
              </p>
            </div>

            <div
              data-testid="smart-card-actions-grid"
              data-action-count={smartActions.length}
              className={cn("grid gap-2.5 sm:gap-3", actionGridClassName)}
            >
              {smartActions.map((action) => {
                const Icon = action.icon;
                const isDownloadAction = action.key === "vcard";
                const actionLabel =
                  isDownloadAction && isVcardDownloading
                    ? "Saving contact..."
                    : action.label;

                if (!isDownloadAction) {
                  return (
                    <a
                      key={action.key}
                      href={action.href}
                      target={action.key === "whatsapp" ? "_blank" : undefined}
                      rel={action.key === "whatsapp" ? "noreferrer" : undefined}
                      aria-label={action.label}
                      className={cn(
                        "flex min-h-[72px] items-center gap-3 rounded-[24px] border border-border bg-surface/70 px-3.5 py-3 text-left transition-all sm:min-h-[84px] sm:px-4 sm:py-4",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandRose/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "hover:-translate-y-0.5 hover:border-brandRose/30 hover:bg-surface",
                        "dark:hover:border-brandCyan/30",
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan sm:h-11 sm:w-11">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-5 text-foreground">
                          {actionLabel}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center self-center">
                        <ExternalLink className="h-4 w-4 text-muted" />
                      </div>
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
                      "flex min-h-[72px] items-center gap-3 rounded-[24px] border border-border bg-surface/70 px-3.5 py-3 text-left transition-all sm:min-h-[84px] sm:px-4 sm:py-4",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandRose/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "hover:-translate-y-0.5 hover:border-brandRose/30 hover:bg-surface",
                      "dark:hover:border-brandCyan/30",
                      isVcardDownloading &&
                        "cursor-wait opacity-70 hover:translate-y-0 hover:border-border hover:bg-surface/70 dark:hover:border-border",
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan sm:h-11 sm:w-11">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5 text-foreground">
                        {actionLabel}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center self-center">
                      <Download className="h-4 w-4 text-muted" />
                    </div>
                  </button>
                );
              })}
            </div>

            {directActionState.status === "error" ? (
              <p role="alert" className="text-sm leading-6 text-rose-500 dark:text-rose-300">
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

        <div className="rounded-[24px] border border-border bg-surface/60 p-4">
          <div className="space-y-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
              Card mode
            </p>
            <p className="text-sm leading-6 text-muted">
              This profile is using Smart Card mode. Keep the interaction short,
              direct, and tap-friendly.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}