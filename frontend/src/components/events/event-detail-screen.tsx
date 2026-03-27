"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { eventApi } from "@/lib/api/event-api";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import type {
  EventParticipant,
  EventStatus,
  EventSummary,
} from "@/types/event";
import type { UserProfile } from "@/types/user";

import { VerificationPrompt } from "../auth/verification-prompt";

import { DiscoveryToggle } from "./discovery-toggle";
import { ParticipantsList } from "./participants-list";

interface EventDetailScreenProps {
  eventId: string;
  user: UserProfile;
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
    <div className="relative overflow-hidden rounded-3xl bg-foreground/[0.03] shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
      {/* Blurred ghost rows to hint at content underneath */}
      <div
        className="pointer-events-none select-none space-y-3 p-4 blur-sm"
        aria-hidden
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-foreground/[0.05] dark:bg-white/[0.06]"
          />
        ))}
      </div>
      {/* Overlay label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/70 backdrop-blur-[2px]">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.05] shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.06] dark:ring-white/10">
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
        <p className="label-xs text-muted">Private presence</p>
        <p className="px-6 text-center text-xs text-muted">
          Turn on your Discovery Signal to see who is present here.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EventDetailScreen
// ---------------------------------------------------------------------------
export function EventDetailScreen({ eventId, user }: EventDetailScreenProps) {
  const canEnableDiscovery = hasUnlockedTrustRequirement(
    user,
    "enable_event_discovery",
  );
  const canViewParticipants = hasUnlockedTrustRequirement(
    user,
    "view_event_participants",
  );

  const router = useRouter();
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
        if (isExpiredSessionError(err)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.eventDetail(eventId))}&reason=expired`,
          );
          return;
        }

        if (!cancelled)
          setLoadError(
            err instanceof Error
              ? err.message
              : "Unable to load this gathering.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, router]);

  // Load participants — only called when discovery is ON and event is live
  const loadParticipants = useCallback(() => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    eventApi
      .listParticipants(eventId)
      .then(setParticipants)
      .catch((err: unknown) => {
        if (isExpiredSessionError(err)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.eventDetail(eventId))}&reason=expired`,
          );
          return;
        }

        setParticipantsError(
          err instanceof Error ? err.message : "Unable to load attendees.",
        );
      })
      .finally(() => setParticipantsLoading(false));
  }, [eventId, router]);

  useEffect(() => {
    if (
      canViewParticipants &&
      event?.status === "live" &&
      event.myParticipation?.discoverable === true
    ) {
      loadParticipants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewParticipants, event?.id, loadParticipants]);

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
          loadParticipants();
        } else {
          setParticipants([]);
          setParticipantsError(null);
        }
      }
    } catch (err: unknown) {
      if (isExpiredSessionError(err)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.eventDetail(eventId))}&reason=expired`,
        );
        return;
      }

      setDiscoveryError(
        err instanceof Error
          ? err.message
          : "Could not update your visibility.",
      );
    } finally {
      setDiscoveryToggling(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <EmptyState
        title="Could not open this gathering"
        description={loadError ?? "Gathering not found."}
      />
    );
  }

  const badge = statusBadgeProps(event.status);
  const hasJoined = !!event.myParticipation;
  const isDiscoverable = event.myParticipation?.discoverable ?? false;
  const myPersonaId = event.myParticipation?.personaId ?? "";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Event info card ─────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white/82 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05] dark:bg-zinc-950/82 dark:ring-white/[0.06]">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {event.name}
            </h2>
            <StatusBadge label={badge.label} tone={badge.tone} />
          </div>

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
      </div>

      {/* ── Not joined ──────────────────────────────────────────────────── */}
      {!hasJoined ? (
        <EmptyState
          title="You have not joined this gathering"
          description="Use the private code or invitation link from the host to enter."
        />
      ) : null}

      {/* ── Discovery Signal card (joined only) ─────────────────────────── */}
      {hasJoined ? (
        <div className="rounded-3xl bg-white/82 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05] dark:bg-zinc-950/82 dark:ring-white/[0.06]">
          <DiscoveryToggle
            enabled={isDiscoverable}
            onToggle={handleDiscoveryToggle}
            isLoading={discoveryToggling}
            disabled={!canEnableDiscovery}
          />
          {!canEnableDiscovery ? (
            <div className="mt-4">
              <VerificationPrompt
                compact
                email={user.email}
                title="Verify your account before enabling discovery"
                description="Participant visibility and discovery stay reserved for accounts with a verified email or mobile verification. Add either one to turn on event discovery."
              />
            </div>
          ) : null}
          {discoveryError ? (
            <div className="mt-3 rounded-2xl bg-rose-500/5 px-4 py-3 ring-1 ring-inset ring-rose-500/20">
              <p className="font-mono text-sm text-rose-500 dark:text-rose-400">
                {discoveryError}
              </p>
            </div>
          ) : null}
          <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
            <p className="font-mono text-xs text-muted">
              Present as{" "}
              <span className="font-medium capitalize text-foreground">
                {event.myParticipation?.role ?? "attendee"}
              </span>
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Participants section (live window only, joined only) ─────────── */}
      {hasJoined && event.status === "live" ? (
        <section className="flex flex-col gap-3">
          <h3 className="label-xs text-muted">People present</h3>

          {!canViewParticipants ? (
            <VerificationPrompt
              compact
              email={user.email}
              title="Verify your account to view attendees"
              description="Dotly only reveals discoverable event attendees to accounts with a verified email or mobile verification."
            />
          ) : !isDiscoverable ? (
            <StealthShield />
          ) : participantsLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-3xl" />
              ))}
            </div>
          ) : participantsError ? (
            <EmptyState
              title="Could not load attendees"
              description={participantsError}
            />
          ) : participants.length === 0 ? (
            <EmptyState
              title="No one else is visible yet"
              description="You are the first to share your presence here. Others will appear as they turn on discovery."
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
        <div className="rounded-3xl bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <p className="text-center font-mono text-xs text-muted">
            Participant discovery opens once the gathering is live.
          </p>
        </div>
      ) : null}

      {/* ── Ended ────────────────────────────────────────────────────────── */}
      {hasJoined && event.status === "ended" ? (
        <div className="rounded-3xl bg-foreground/[0.03] p-5 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
          <p className="text-center font-mono text-xs text-muted">
            This gathering has ended. Discovery is now closed.
          </p>
        </div>
      ) : null}
    </div>
  );
}
