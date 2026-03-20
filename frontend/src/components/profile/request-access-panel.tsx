"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { requestApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { PersonaSummary, PublicProfile } from "@/types";

interface RequestAccessPanelProps {
  profile: PublicProfile;
  initialPersonas: PersonaSummary[];
  isAuthenticated: boolean;
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

    if (error.status === 403) {
      return "This profile is not accepting requests right now.";
    }

    if (error.status === 409) {
      return "Request already pending";
    }

    return error.message;
  }

  return "We could not send your request right now. Please try again.";
}

export function RequestAccessPanel({
  profile,
  initialPersonas,
  isAuthenticated,
  personaLoadError = null,
}: RequestAccessPanelProps) {
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    initialPersonas[0]?.id ?? "",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginHref = useMemo(
    () => buildLoginHref(profile.username),
    [profile.username],
  );
  const isOwnProfile = useMemo(
    () =>
      initialPersonas.some(
        (persona) =>
          persona.id === profile.id || persona.username === profile.username,
      ),
    [initialPersonas, profile.id, profile.username],
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
      await requestApi.send({
        toPersonaId: profile.id,
        fromPersonaId: selectedPersonaId,
        reason: reason.trim() || undefined,
        sourceType: "profile",
        sourceId: null,
      });

      setSuccessMessage(`Request Sent`);
    } catch (submissionError) {
      setError(toFriendlyMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (profile.accessMode === "private") {
    return (
      <Card className="space-y-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brandRose dark:text-brandCyan">
          Requests Restricted
        </p>
        <h2 className="font-sans text-lg font-semibold text-foreground">
          This profile is private
        </h2>
        <p className="text-sm leading-6 text-muted">
          The owner is not accepting access requests from public profile links.
        </p>
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
            Log in to connect
          </h2>
          <p className="text-sm leading-6 text-muted">
            Connect with {profile.fullName} using your own Dotly personas.
          </p>
        </div>
        <Link href={loginHref} className="block">
          <PrimaryButton className="w-full">Login to Connect</PrimaryButton>
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
            This persona belongs to you
          </h2>
          <p className="text-sm leading-6 text-muted">
            Contact requests are only for reaching other people. Manage your own
            personas from the workspace.
          </p>
        </div>
        <Link href={routes.app.personas} className="block">
          <SecondaryButton className="w-full">Open personas</SecondaryButton>
        </Link>
      </Card>
    );
  }

  if (personaLoadError) {
    return (
      <Card className="space-y-3 border-rose-200 bg-rose-50/80">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-rose-700">
          Unable to continue
        </p>
        <p className="text-sm leading-6 text-rose-700">{personaLoadError}</p>
      </Card>
    );
  }

  if (initialPersonas.length === 0) {
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
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brandRose dark:text-brandCyan">
          Request access
        </p>
        <h2 className="font-sans text-lg font-semibold text-foreground">
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
            className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
          >
            Send from
          </label>
          <select
            id="fromPersonaId"
            className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 font-sans text-sm text-foreground outline-none transition focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
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

        <div className="space-y-2">
          <label
            htmlFor="reason"
            className="block font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
          >
            Add Context
          </label>
          <textarea
            id="reason"
            maxLength={280}
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 font-sans text-sm text-foreground outline-none transition focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
            placeholder="Tell them why you'd like to connect (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isSubmitting || Boolean(successMessage)}
          />
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="pt-2">
          {successMessage ? (
            <div className="flex h-[60px] w-full items-center justify-center rounded-2xl bg-brandRose/10 px-5 font-sans text-sm font-bold text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan">
              Request Sent
            </div>
          ) : (
            <PrimaryButton
              type="submit"
              className="h-[60px] w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending request..." : "Request Access"}
            </PrimaryButton>
          )}
        </div>
      </form>
    </Card>
  );
}
