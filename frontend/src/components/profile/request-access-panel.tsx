"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { showToast } from "@/components/shared/toast-viewport";
import { publicApi, requestApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { routes } from "@/lib/constants/routes";
import { resolvePreferredPersonaId } from "@/lib/persona/default-persona";
import { formatPrimaryAction } from "@/lib/persona/labels";
import {
  hasPublicSmartCardDirectActions,
  resolvePublicSmartCardPrimaryCta,
} from "@/lib/persona/smart-card";
import { cn } from "@/lib/utils/cn";
import type {
  PersonaSummary,
  PublicProfile,
  PublicProfileRequestTarget,
} from "@/types";
import type { UserProfile } from "@/types/user";

import { VerificationPrompt } from "../auth/verification-prompt";

interface RequestAccessPanelProps {
  profile: PublicProfile;
  initialPersonas: PersonaSummary[];
  isAuthenticated: boolean;
  currentUser?: UserProfile | null;
  personaLoadError?: string | null;
}

function buildLoginHref(username: string): string {
  return `${routes.public.login}?next=${encodeURIComponent(`/u/${username}`)}`;
}

function toFriendlyMessage(error: unknown): string {
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

      if (
        msg.toLowerCase().includes("private") ||
        msg.toLowerCase().includes("not accepting")
      ) {
        return "This profile is not accepting requests at this time.";
      }

      if (msg.toLowerCase().includes("cooldown")) {
        return "Cooldown Required. Try again later.";
      }

      return "This profile is not accepting requests at this time.";
    }

    if (error.status === 409) {
      return "Request already pending.";
    }

    return error.message;
  }

  return "We could not send your request right now. Please try again.";
}

export function RequestAccessPanel({
  profile,
  initialPersonas,
  isAuthenticated,
  currentUser = null,
  personaLoadError = null,
}: RequestAccessPanelProps) {
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    resolvePreferredPersonaId(initialPersonas),
  );
  const [showCustomizeOptions, setShowCustomizeOptions] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestTarget, setRequestTarget] =
    useState<PublicProfileRequestTarget | null>(null);

  const loginHref = useMemo(
    () => buildLoginHref(profile.username),
    [profile.username],
  );
  const isOwnProfile = useMemo(
    () =>
      initialPersonas.some((persona) => persona.username === profile.username),
    [initialPersonas, profile.username],
  );
  const smartCardPrimaryCta =
    profile.sharingMode === "smart_card"
      ? profile.smartCard
        ? resolvePublicSmartCardPrimaryCta(profile.smartCard.primaryAction, {
            instantConnectUrl: profile.instantConnectUrl,
            actionState: profile.smartCard.actionState,
            hasDirectActions: hasPublicSmartCardDirectActions(profile),
          })
        : null
      : null;
  const smartCardPrimaryAction = smartCardPrimaryCta?.action ?? null;
  const smartCardLoginDescription =
    smartCardPrimaryAction === null
      ? "This profile isn't available right now. Log in and try again later."
      : "Log in to connect or request access.";
  const smartCardPrimaryActionHeading =
    smartCardPrimaryAction === null
      ? "This profile is currently unavailable"
      : `${formatPrimaryAction(smartCardPrimaryAction)} is the next step`;
  const smartCardRequestDescription =
    smartCardPrimaryAction === null
      ? `This profile isn't available right now. Try again later.`
      : `Send a simple connection request to ${profile.fullName}.`;
  const isSmartCardMisconfigured =
    profile.sharingMode === "smart_card" && profile.smartCard === null;
  const supportsRequestAccess =
    profile.sharingMode === "controlled" ||
    (smartCardPrimaryCta?.action === "request_access" &&
      !smartCardPrimaryCta.isDisabled);
  const canSendRequest = hasUnlockedTrustRequirement(
    currentUser,
    "send_contact_request",
  );
  const selectedPersona =
    initialPersonas.find((persona) => persona.id === selectedPersonaId) ?? null;
  const hasMultiplePersonas = initialPersonas.length > 1;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPersonaId) {
      setError(
        "Dotly needs one of your personas before it can send this request.",
      );
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const target =
        requestTarget ?? (await publicApi.getRequestTarget(profile.username));

      setRequestTarget(target);

      await requestApi.send({
        toUsername: target.username,
        fromPersonaId: selectedPersonaId,
        reason: reason.trim() || undefined,
        sourceType: "profile",
        sourceId: null,
      });

      setSuccessMessage("Request sent ✓");
      setShowCustomizeOptions(false);
      showToast("Request sent");
    } catch (submissionError) {
      setError(toFriendlyMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSmartCardMisconfigured) {
    return (
      <Card className="space-y-4 border-amber-300/50 bg-amber-50/80 dark:border-status-warning/25 dark:bg-status-warning/10">
        <div className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-status-warning">
            Profile unavailable
          </p>
          <h2 className="font-sans text-lg font-semibold text-foreground">
            This profile isn&apos;t ready right now
          </h2>
          <p className="text-sm leading-6 text-muted">Try again later.</p>
        </div>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
            Request access
          </p>
          <h2 className="font-sans text-lg font-semibold text-foreground">
            Log in to continue
          </h2>
          <p className="text-sm leading-6 text-muted">
            {profile.sharingMode === "smart_card"
              ? smartCardLoginDescription
              : `Log in to request access to ${profile.fullName}.`}
          </p>
        </div>
        <Link href={loginHref} className="block">
          <PrimaryButton className="w-full">Log in to continue</PrimaryButton>
        </Link>
      </Card>
    );
  }

  if (isOwnProfile) {
    return (
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
            Your profile
          </p>
          <h2 className="font-sans text-lg font-semibold text-foreground">
            This is your Dotly
          </h2>
          <p className="text-sm leading-6 text-muted">
            Requests are for connecting with other people.
          </p>
        </div>
        <Link href={routes.app.personas} className="block">
          <SecondaryButton className="w-full">Open your Dotlys</SecondaryButton>
        </Link>
      </Card>
    );
  }

  if (!supportsRequestAccess) {
    return (
      <Card className="space-y-4 border-cyan-200 bg-cyan-50/70 dark:border-brandCyan/25 dark:bg-brandCyan/10">
        <div className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan-700 dark:text-brandCyan">
            Profile access
          </p>
          <h2 className="font-sans text-lg font-semibold text-foreground">
            {smartCardPrimaryActionHeading}
          </h2>
          <p className="text-sm leading-6 text-muted">
            Use the action above to continue.
          </p>
        </div>
      </Card>
    );
  }

  if (personaLoadError) {
    return (
      <Card className="space-y-3 border-rose-500/30 bg-rose-500/10">
        <p className="label-xs text-rose-500 dark:text-rose-400">
          Unable to continue
        </p>
        <p className="text-sm leading-6 text-rose-600 dark:text-rose-400">
          {personaLoadError}
        </p>
      </Card>
    );
  }

  if (currentUser && !canSendRequest) {
    return (
      <VerificationPrompt
        email={currentUser.email}
        title="Verify your account before sending a request"
        description={`Verify your email or phone before requesting access to ${profile.fullName}.`}
      />
    );
  }

  if (initialPersonas.length === 0) {
    return (
      <EmptyState
        title="Create a profile to send requests"
        description="Create a profile before you request access to someone else."
        action={
          <Link href={routes.app.createPersona}>
            <PrimaryButton className="w-full">Create profile</PrimaryButton>
          </Link>
        }
      />
    );
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brandRose dark:text-brandCyan">
          Connect
        </p>
        <h2 className="font-sans text-lg font-semibold text-foreground">
          Request to connect
        </h2>
        <p className="text-sm leading-6 text-muted">
          {profile.sharingMode === "smart_card"
            ? smartCardRequestDescription
            : `Send a request to ${profile.fullName} instantly with your default persona.`}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCustomizeOptions((current) => !current)}
            disabled={isSubmitting || Boolean(successMessage)}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-foreground"
          >
            {showCustomizeOptions ? "Keep this Dotly" : "Use another Dotly"}
          </button>
        </div>

        {showCustomizeOptions ? (
          <div className="space-y-4">
            {hasMultiplePersonas ? (
              <div className="space-y-2">
                <label
                  htmlFor="fromPersonaId"
                  className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
                >
                  Send from
                </label>
                {selectedPersona ? (
                  <div className="rounded-2xl border border-border bg-surface/60 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">
                      {selectedPersona.fullName}
                    </p>
                    <p className="text-sm text-muted">
                      @{selectedPersona.username}
                    </p>
                  </div>
                ) : null}
                <select
                  id="fromPersonaId"
                  className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 font-sans text-sm text-foreground outline-none transition-all focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
                  value={selectedPersonaId}
                  onChange={(event) => setSelectedPersonaId(event.target.value)}
                  disabled={isSubmitting || Boolean(successMessage)}
                >
                  {initialPersonas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.fullName} - @{persona.username}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <label
                htmlFor="reason"
                className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
              >
                Add a note
              </label>
              <textarea
                id="reason"
                maxLength={280}
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 font-sans text-sm text-foreground outline-none transition-all placeholder:text-muted/50 focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
                placeholder="Add a note they will recognize later (optional)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isSubmitting || Boolean(successMessage)}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500 bg-rose-500/10 px-4 py-3">
            <p className="font-mono text-sm text-rose-500">{error}</p>
          </div>
        ) : null}

        <div className="pt-2">
          {successMessage ? (
            <PrimaryButton
              type="button"
              className="h-[60px] w-full"
              isSuccess
              disabled
            >
              Request sent ✓
            </PrimaryButton>
          ) : (
            <PrimaryButton
              type="submit"
              className="h-[60px] w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Request to connect"}
            </PrimaryButton>
          )}
        </div>
      </form>
    </Card>
  );
}
