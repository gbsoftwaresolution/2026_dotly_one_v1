"use client";

import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { eventApi } from "@/lib/api/event-api";
import { personaApi } from "@/lib/api/persona-api";
import type { PersonaSummary } from "@/types/persona";
import type { EventSummary } from "@/types/event";

import { EventCard } from "./event-card";

// ---------------------------------------------------------------------------
// Join panel
// ---------------------------------------------------------------------------

interface JoinPanelProps {
  onJoined: (event: EventSummary) => void;
}

function JoinPanel({ onJoined }: JoinPanelProps) {
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
      // The access code IS the event ID — backend join is POST /events/:id/join
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

  return (
    <div>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-between rounded-3xl border border-dashed border-slate-200 bg-white/50 px-5 py-5 text-sm font-semibold text-slate-500 transition-colors hover:border-brandRose hover:text-brandRose dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400 dark:hover:border-brandCyan dark:hover:text-brandCyan"
        >
          <span>Join an event</span>
          <span className="font-mono text-xs tracking-widest">
            + Enter code
          </span>
        </button>
      ) : (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="event-code"
                className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
              >
                Event Access Code
              </label>
              <input
                ref={inputRef}
                id="event-code"
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="Paste the event ID or code"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-foreground placeholder:text-slate-400 focus:border-brandRose focus:outline-none focus:ring-2 focus:ring-brandRose/20 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Persona selector */}
            <div className="space-y-1">
              <label
                htmlFor="event-persona"
                className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted"
              >
                Attend as
              </label>
              {personasLoading ? (
                <div className="h-10 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" />
              ) : personas.length === 0 ? (
                <p className="text-xs text-muted">
                  No personas found. Create one first.
                </p>
              ) : (
                <select
                  id="event-persona"
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground focus:border-brandRose focus:outline-none focus:ring-2 focus:ring-brandRose/20 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20"
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
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {error}
              </p>
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
                className="rounded-2xl border border-slate-200 px-5 py-5 text-sm font-semibold text-muted transition-colors hover:text-foreground dark:border-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventsScreen
// ---------------------------------------------------------------------------

export function EventsScreen() {
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
  }, []);

  function handleJoined(event: EventSummary) {
    // Prepend the newly joined event and avoid duplicates
    setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)]);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
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
    <div className="space-y-3">
      <JoinPanel onJoined={handleJoined} />

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
