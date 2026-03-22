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
  onClick?: () => void;
}

function avatarHue(seed: string): number {
  return ((seed.charCodeAt(0) || 72) * 137) % 360;
}

async function downloadVcard(href: string, username: string) {
  const response = await window.fetch(href, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Unable to download vCard");
  }

  const file = await response.blob();
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${username}.vcf`;
  anchor.click();

  URL.revokeObjectURL(url);
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
      onClick: () => {
        void handleVcardAction(actionLinks.vcard!);
      },
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
    try {
      await downloadVcard(href, profile.username);
      setDirectActionSuccessState("Contact download started.");
    } catch {
      setDirectActionErrorState("Save Contact is unavailable right now.");
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
        className="relative overflow-hidden px-6 pb-6 pt-7"
        style={{
          background: `radial-gradient(circle at top right, hsla(${(hue + 28) % 360}, 90%, 72%, 0.24), transparent 34%), linear-gradient(160deg, hsl(${hue}, 56%, 13%) 0%, hsl(${(hue + 22) % 360}, 48%, 11%) 46%, hsl(${(hue + 58) % 360}, 44%, 9%) 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_42%)]" />

        <div className="relative space-y-6">
          <div className="flex items-start gap-4">
            {profile.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profilePhotoUrl}
                alt={profile.fullName}
                className="h-20 w-20 rounded-[26px] object-cover ring-1 ring-white/20"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-[26px] text-2xl font-bold text-white ring-1 ring-white/20"
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
                <h1 className="text-[2rem] font-black leading-none tracking-tight text-white">
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

          <div className="rounded-[28px] border border-white/12 bg-white/[0.08] p-4 backdrop-blur-sm">
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
                className="h-[68px] w-full gap-3 rounded-[24px] text-base"
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

      <div className="space-y-4 px-6 py-6">
        {shouldShowDirectActions ? (
          <div
            ref={contactPanelRef}
            className={cn(
              "space-y-3 rounded-[24px] border border-border bg-surface/60 p-4 transition-colors",
              isContactPanelHighlighted &&
                "border-brandRose/35 bg-brandRose/5 dark:border-brandCyan/35 dark:bg-brandCyan/10",
            )}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
                  Direct actions
                </p>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted">
                  Direct contact available
                </span>
              </div>
              <p className="text-sm leading-6 text-muted">
                Choose the fastest channel for this conversation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {smartActions.map((action) => {
                const Icon = action.icon;

                if (action.key !== "vcard") {
                  return (
                    <a
                      key={action.key}
                      href={action.href}
                      target={action.key === "whatsapp" ? "_blank" : undefined}
                      rel={action.key === "whatsapp" ? "noreferrer" : undefined}
                      className={cn(
                        "flex min-h-[84px] flex-col justify-between rounded-[24px] border border-border bg-surface/70 p-4 transition-all",
                        "hover:-translate-y-0.5 hover:border-brandRose/30 hover:bg-surface",
                        "dark:hover:border-brandCyan/30",
                      )}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {action.label}
                        </span>
                        <ExternalLink className="h-4 w-4 text-muted" />
                      </div>
                    </a>
                  );
                }

                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className={cn(
                      "flex min-h-[84px] flex-col justify-between rounded-[24px] border border-border bg-surface/70 p-4 text-left transition-all",
                      "hover:-translate-y-0.5 hover:border-brandRose/30 hover:bg-surface",
                      "dark:hover:border-brandCyan/30",
                    )}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brandRose/10 text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {directActionState.status === "error" ? (
              <p role="alert" className="text-sm leading-6 text-rose-500 dark:text-rose-300">
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

        {profile.links.length > 0 ? (
          <div className="space-y-3 rounded-[24px] border border-border bg-surface/60 p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">
              Links
            </p>
            <div className="space-y-2">
              {profile.links.map((link) => (
                <a
                  key={`${link.kind}:${link.href}`}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:border-brandRose/30 dark:hover:border-brandCyan/30"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="h-4 w-4 text-muted" />
                </a>
              ))}
            </div>
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