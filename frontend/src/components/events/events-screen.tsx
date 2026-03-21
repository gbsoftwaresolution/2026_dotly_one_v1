"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { eventApi } from "@/lib/api/event-api";
import { personaApi } from "@/lib/api/persona-api";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import type { PersonaSummary } from "@/types/persona";
import type { EventSummary } from "@/types/event";

import { VerificationPrompt } from "../auth/verification-prompt";

import { EventCard } from "./event-card";

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------
const inputCls =
  "min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-normal text-foreground outline-none transition-all placeholder:text-muted/50 focus:border-brandRose focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20";

// ---------------------------------------------------------------------------
// Join panel
// ---------------------------------------------------------------------------

interface JoinPanelProps {
  onJoined: (event: EventSummary) => void;
  isVerified: boolean;
  currentUserEmail: string;
}

function JoinPanel({
  onJoined,
  isVerified,
  currentUserEmail,
}: JoinPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [eventCode, setEventCode] = useState("");
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load personas when panel opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPersonasLoading(true);
    personaApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setPersonas(data);
          if (data.length > 0) setSelectedPersonaId(data[0].id);
        }
      })
      .catch(() => {
        // Non-fatal — user can still type but submit will validate
      })
      .finally(() => {
        if (!cancelled) setPersonasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = eventCode.trim();
    if (!trimmed) {
      setError("Enter an event access code.");
      return;
    }
    if (!selectedPersonaId) {
      setError("Select a persona to attend as.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const event = await eventApi.join(trimmed, {
        personaId: selectedPersonaId,
      });
      setEventCode("");
      setIsOpen(false);
      onJoined(event);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not join event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isVerified) {
    return (
      <VerificationPrompt
        email={currentUserEmail}
        title="Verify your email before joining events"
        description="Dotly event networking only opens for verified accounts. Verify your email to join an event and participate in discovery safely."
      />
    );
  }

  return (
    <div>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-between rounded-3xl border border-dashed border-border bg-surface/50 px-5 py-5 text-sm font-semibold text-muted transition-all hover:border-brandRose hover:text-brandRose dark:hover:border-brandCyan dark:hover:text-brandCyan active:scale-[0.98]"
        >
          <span>Join an event</span>
          <span className="font-mono text-xs tracking-widest">
            + Enter code
          </span>
        </button>
      ) : (
        <div className="glass rounded-3xl border border-border bg-surface p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="event-code" className="label-xs text-muted">
                Event Access Code
              </label>
              <input
                ref={inputRef}
                id="event-code"
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="Paste the event access code"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Persona selector */}
            <div className="space-y-1.5">
              <label htmlFor="event-persona" className="label-xs text-muted">
                Attend as
              </label>
              {personasLoading ? (
                <div className="h-12 animate-pulse rounded-2xl bg-surface" />
              ) : personas.length === 0 ? (
                <p className="text-xs text-muted">
                  No personas found. Create one first.
                </p>
              ) : (
                <select
                  id="event-persona"
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                  className={inputCls}
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} · {p.jobTitle}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                <p className="font-mono text-sm text-rose-500 dark:text-rose-400">
                  {error}
                </p>
              </div>
            ) : null}

            <div className="flex gap-3">
              <PrimaryButton
                type="submit"
                disabled={isSubmitting || personasLoading}
                className="flex-1"
              >
                {isSubmitting ? "Joining…" : "Join Event"}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setEventCode("");
                  setError(null);
                }}
                className="rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-muted transition-all hover:text-foreground hover:border-foreground/20 active:scale-95"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventsScreen
// ---------------------------------------------------------------------------

export function EventsScreen({
  isVerified,
  currentUserEmail,
}: {
  isVerified: boolean;
  currentUserEmail: string;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    eventApi
      .list()
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((err: unknown) => {
        if (isExpiredSessionError(err)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.events)}&reason=expired`,
          );
          router.refresh();
          return;
        }

        if (!cancelled)
          setLoadError(
            err instanceof Error ? err.message : "Unable to load events.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleJoined(event: EventSummary) {
    setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (loadError) {
    return <EmptyState title="Could not load events" description={loadError} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <JoinPanel
        onJoined={handleJoined}
        isVerified={isVerified}
        currentUserEmail={currentUserEmail}
      />

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Join an event using the access code or link shared by the organizer."
        />
      ) : (
        events.map((event) => <EventCard key={event.id} event={event} />)
      )}
    </div>
  );
}
