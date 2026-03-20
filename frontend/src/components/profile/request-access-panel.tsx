"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi, requestApi } from "@/lib/api";
import { ApiError, isApiError } from "@/lib/api/client";
import { useAuthState } from "@/hooks/use-auth-state";
import { routes } from "@/lib/constants/routes";
import type { PersonaSummary, PublicProfile } from "@/types";

interface RequestAccessPanelProps {
  profile: PublicProfile;
}

function buildLoginHref(username: string): string {
  return `${routes.public.login}?next=${encodeURIComponent(`/u/${username}`)}`;
}

function toFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Log in to send a request from one of your personas.";
    }

    if (error.status === 403) {
      return "This profile is not accepting requests right now.";
    }

    if (error.status === 409) {
      return "You already have a pending request for this profile.";
    }

    return error.message;
  }

  return "We could not send your request right now. Please try again.";
}

export function RequestAccessPanel({ profile }: RequestAccessPanelProps) {
  const session = useAuthState();
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [personaLoadError, setPersonaLoadError] = useState<string | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!session.isAuthenticated) {
      setPersonas([]);
      setSelectedPersonaId("");
      return;
    }

    let isActive = true;
    setIsLoadingPersonas(true);
    setPersonaLoadError(null);

    void personaApi
      .list()
      .then((nextPersonas) => {
        if (!isActive) {
          return;
        }

        setPersonas(nextPersonas);
        setSelectedPersonaId((currentSelectedPersonaId) => {
          if (
            currentSelectedPersonaId &&
            nextPersonas.some(
              (persona) => persona.id === currentSelectedPersonaId,
            )
          ) {
            return currentSelectedPersonaId;
          }

          return nextPersonas[0]?.id ?? "";
        });
      })
      .catch((personaError) => {
        if (!isActive) {
          return;
        }

        setPersonaLoadError(
          isApiError(personaError)
            ? personaError.message
            : "We could not load your personas right now.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPersonas(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [session.isAuthenticated]);

  const loginHref = useMemo(
    () => buildLoginHref(profile.username),
    [profile.username],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPersonaId || !profile.id) {
      setError("Choose a persona before sending your request.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await requestApi.sendRequest({
        toPersonaId: profile.id,
        fromPersonaId: selectedPersonaId,
        reason: reason.trim() || undefined,
        sourceType: "profile",
        sourceId: null,
      });

      setSuccessMessage(`Request sent to ${profile.fullName}.`);
    } catch (submissionError) {
      setError(toFriendlyMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (profile.accessMode === "private") {
    return (
      <Card className="space-y-3 border-amber-200 bg-amber-50/80">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Requests unavailable
        </p>
        <h2 className="text-lg font-semibold text-slate-900">
          This profile is private
        </h2>
        <p className="text-sm leading-6 text-slate-700">
          The owner is not accepting access requests from public profile links.
        </p>
      </Card>
    );
  }

  if (session.isLoading) {
    return (
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Request access
        </p>
        <p className="text-sm text-muted">Checking your session...</p>
      </Card>
    );
  }

  if (!session.isAuthenticated) {
    return (
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Request access
          </p>
          <h2 className="text-lg font-semibold text-foreground">
            Log in to request access
          </h2>
          <p className="text-sm leading-6 text-muted">
            Choose one of your personas and send a short introduction to connect
            with {profile.fullName}.
          </p>
        </div>
        <Link href={loginHref} className="block">
          <PrimaryButton className="w-full">Log in to continue</PrimaryButton>
        </Link>
      </Card>
    );
  }

  if (isLoadingPersonas) {
    return (
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Request access
        </p>
        <p className="text-sm text-muted">Loading your personas...</p>
      </Card>
    );
  }

  if (personaLoadError) {
    return (
      <Card className="space-y-3 border-rose-200 bg-rose-50/80">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
          Unable to continue
        </p>
        <p className="text-sm leading-6 text-rose-700">{personaLoadError}</p>
      </Card>
    );
  }

  if (personas.length === 0) {
    return (
      <EmptyState
        title="Create a persona to send requests"
        description="You need at least one persona before you can request access to another profile."
        action={
          <Link href={routes.app.createPersona}>
            <PrimaryButton className="w-full">Create persona</PrimaryButton>
          </Link>
        }
      />
    );
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Request access
        </p>
        <h2 className="text-lg font-semibold text-foreground">
          Reach out from one of your personas
        </h2>
        <p className="text-sm leading-6 text-muted">
          Send a request to {profile.fullName}. They can approve or reject it
          from their requests screen.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="fromPersonaId"
            className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Send from
          </label>
          <select
            id="fromPersonaId"
            className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-blue-100"
            value={selectedPersonaId}
            onChange={(event) => setSelectedPersonaId(event.target.value)}
            disabled={isSubmitting || Boolean(successMessage)}
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.fullName} - @{persona.username}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="reason"
            className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
          >
            Reason (optional)
          </label>
          <textarea
            id="reason"
            maxLength={280}
            rows={4}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-blue-100"
            placeholder="Tell them why you'd like to connect."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isSubmitting || Boolean(successMessage)}
          />
          <p className="text-right text-xs text-muted">{reason.length}/280</p>
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton
            type="submit"
            className="w-full"
            disabled={isSubmitting || Boolean(successMessage)}
          >
            {successMessage
              ? "Request sent"
              : isSubmitting
                ? "Sending request..."
                : "Request Access"}
          </PrimaryButton>
          <Link href={routes.app.requests} className="w-full sm:w-auto">
            <SecondaryButton className="w-full">View requests</SecondaryButton>
          </Link>
        </div>
      </form>
    </Card>
  );
}
