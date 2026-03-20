"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { eventApi } from "@/lib/api/event-api";
import type {
  EventParticipant,
  EventStatus,
  EventSummary,
} from "@/types/event";

import { DiscoveryToggle } from "./discovery-toggle";
import { ParticipantsList } from "./participants-list";

interface EventDetailScreenProps {
  eventId: string;
}

function statusBadgeProps(status: EventStatus) {
  switch (status) {
    case "live":
      return { label: "Live now", tone: "success" as const };
    case "upcoming":
      return { label: "Upcoming", tone: "warning" as const };
    case "ended":
      return { label: "Ended", tone: "neutral" as const };
  }
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

// ---------------------------------------------------------------------------
// Stealth shield — shown when discovery is OFF and the event is live
// ---------------------------------------------------------------------------
function StealthShield() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
      {/* Blurred ghost rows to hint at content underneath */}
      <div
        className="space-y-3 p-4 blur-sm select-none pointer-events-none"
        aria-hidden
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-slate-100 dark:bg-zinc-900"
          />
        ))}
      </div>
      {/* Overlay label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-[2px]">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-muted"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </div>
        <p className="font-mono text-xs font-semibold text-muted uppercase tracking-widest">
          Stealth Mode
        </p>
        <p className="text-xs text-muted text-center px-6">
          Enable your Discovery Signal to see who else is here.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventDetailScreen
// ---------------------------------------------------------------------------
export function EventDetailScreen({ eventId }: EventDetailScreenProps) {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(
    null,
  );

  const [discoveryToggling, setDiscoveryToggling] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Load event
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    eventApi
      .get(eventId)
      .then((data) => {
        if (!cancelled) setEvent(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(
            err instanceof Error ? err.message : "Unable to load event.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Load participants — only called when discovery is ON and event is live
  const loadParticipants = useCallback(() => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    eventApi
      .listParticipants(eventId)
      .then(setParticipants)
      .catch((err: unknown) => {
        setParticipantsError(
          err instanceof Error ? err.message : "Unable to load participants.",
        );
      })
      .finally(() => setParticipantsLoading(false));
  }, [eventId]);

  // Spec requirement: participants are NOT fetched until the user toggles ON
  // Therefore we do NOT auto-load on mount even if discoverable === true.
  // We DO load when the event is first loaded and already discoverable — that
  // reflects the user having toggled on in a previous session.
  useEffect(() => {
    if (
      event?.status === "live" &&
      event.myParticipation?.discoverable === true
    ) {
      loadParticipants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]); // Only on initial load of the event — not on every toggle

  // Discovery toggle handler
  async function handleDiscoveryToggle(enable: boolean) {
    if (!event) return;
    setDiscoveryToggling(true);
    setDiscoveryError(null);
    try {
      if (enable) {
        await eventApi.enableDiscovery(eventId);
      } else {
        await eventApi.disableDiscovery(eventId);
      }

      // Optimistically update local event state
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              myParticipation: prev.myParticipation
                ? { ...prev.myParticipation, discoverable: enable }
                : prev.myParticipation,
            }
          : prev,
      );

      if (event.status === "live") {
        if (enable) {
          // User just turned ON — fetch participants for the first time
          loadParticipants();
        } else {
          // User turned OFF — clear participant list (privacy-first)
          setParticipants([]);
          setParticipantsError(null);
        }
      }
    } catch (err: unknown) {
      setDiscoveryError(
        err instanceof Error ? err.message : "Could not update discovery.",
      );
    } finally {
      setDiscoveryToggling(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <EmptyState
        title="Could not load event"
        description={loadError ?? "Event not found."}
      />
    );
  }

  const badge = statusBadgeProps(event.status);
  const hasJoined = !!event.myParticipation;
  const isDiscoverable = event.myParticipation?.discoverable ?? false;
  const myPersonaId = event.myParticipation?.personaId ?? "";

  return (
    <div className="space-y-5">
      {/* ── Event info card ─────────────────────────────────────────────── */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            {/* Event name — Plus Jakarta Sans */}
            <h2 className="text-lg font-semibold text-foreground">
              {event.name}
            </h2>
            <StatusBadge label={badge.label} tone={badge.tone} />
          </div>

          {/* Timestamps — JetBrains Mono */}
          <p className="font-mono text-sm text-muted">
            {formatDateRange(event.startsAt, event.endsAt)}
          </p>

          {event.location ? (
            <p className="font-mono text-sm text-muted">{event.location}</p>
          ) : null}

          {event.description ? (
            <p className="text-sm text-foreground">{event.description}</p>
          ) : null}
        </div>
      </Card>

      {/* ── Not joined ──────────────────────────────────────────────────── */}
      {!hasJoined ? (
        <EmptyState
          title="You have not joined this event"
          description="Use the event access code or link from the organizer to join."
        />
      ) : null}

      {/* ── Discovery Signal card (joined only) ─────────────────────────── */}
      {hasJoined ? (
        <Card>
          <DiscoveryToggle
            enabled={isDiscoverable}
            onToggle={handleDiscoveryToggle}
            isLoading={discoveryToggling}
          />
          {discoveryError ? (
            <p className="mt-3 font-mono text-xs text-rose-600 dark:text-rose-400">
              {discoveryError}
            </p>
          ) : null}
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-900">
            <p className="font-mono text-xs text-muted">
              Attending as{" "}
              <span className="font-medium capitalize text-foreground">
                {event.myParticipation?.role ?? "attendee"}
              </span>
            </p>
          </div>
        </Card>
      ) : null}

      {/* ── Participants section (live window only, joined only) ─────────── */}
      {hasJoined && event.status === "live" ? (
        <section className="space-y-3">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted">
            People here
          </h3>

          {/* Stealth mode — discovery is OFF */}
          {!isDiscoverable ? (
            <StealthShield />
          ) : participantsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-3xl bg-slate-100 dark:bg-zinc-900"
                />
              ))}
            </div>
          ) : participantsError ? (
            <EmptyState
              title="Could not load participants"
              description={participantsError}
            />
          ) : participants.length === 0 ? (
            <EmptyState
              title="No one else is broadcasting yet"
              description="You are the first to enable discovery here. Others will appear as they turn on their signal."
            />
          ) : (
            <ParticipantsList
              participants={participants}
              eventId={eventId}
              myPersonaId={myPersonaId}
            />
          )}
        </section>
      ) : null}

      {/* ── Upcoming — discovery window not open yet ─────────────────────── */}
      {hasJoined && event.status === "upcoming" ? (
        <Card className="border-dashed">
          <p className="text-center font-mono text-xs text-muted">
            Participant discovery opens when the event goes live.
          </p>
        </Card>
      ) : null}

      {/* ── Ended ────────────────────────────────────────────────────────── */}
      {hasJoined && event.status === "ended" ? (
        <Card className="border-dashed">
          <p className="text-center font-mono text-xs text-muted">
            This event has ended. Discovery is closed.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
