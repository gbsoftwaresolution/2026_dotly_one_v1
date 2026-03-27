"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { CustomSelect } from "@/components/shared/custom-select";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { eventApi } from "@/lib/api/event-api";
import { hasUnlockedTrustRequirement } from "@/lib/auth/trust-requirements";
import { personaApi } from "@/lib/api/persona-api";
import {
  readSessionCache,
  writeSessionCache,
} from "@/lib/client-session-cache";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import type { PersonaSummary } from "@/types/persona";
import type { EventSummary } from "@/types/event";
import type { UserProfile } from "@/types/user";

import { VerificationPrompt } from "../auth/verification-prompt";

import { EventCard } from "./event-card";

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------
const inputCls =
  "min-h-[52px] w-full rounded-2xl bg-white/50 backdrop-blur-md px-4 text-[15px] font-medium text-foreground shadow-sm ring-1 ring-inset ring-black/5 outline-none transition-all duration-500 placeholder:text-muted/50 focus:bg-white/80 focus:ring-black/10 dark:bg-zinc-800/50 dark:ring-white/10 dark:focus:bg-zinc-800/80 hover:-translate-y-1";

const EVENTS_CACHE_KEY = "dotly.events-screen";

// ---------------------------------------------------------------------------
// Join panel
// ---------------------------------------------------------------------------

interface JoinPanelProps {
  onJoined: (event: EventSummary) => void;
  user: UserProfile;
}

function JoinPanel({ onJoined, user }: JoinPanelProps) {
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
      setError("Enter the private event code.");
      return;
    }
    if (!selectedPersonaId) {
      setError("Choose the identity you would like to arrive as.");
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
      setError(
        err instanceof Error ? err.message : "Could not join this gathering.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasUnlockedTrustRequirement(user, "join_event")) {
    return (
      <VerificationPrompt
        email={user.email}
        title="Verify your account before joining gatherings"
        description="Dotly event networking opens only for accounts with a verified email or mobile verification. Add either one to join a gathering and take part in discovery with confidence."
      />
    );
  }

  return (
    <div>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-between rounded-[32px] bg-white/60 backdrop-blur-3xl px-6 py-6 text-sm font-bold text-foreground shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 transition-all duration-500 hover:-translate-y-1 hover:bg-white/80 dark:bg-zinc-900/60 dark:ring-white/10 dark:hover:bg-zinc-800/80 active:scale-[0.98]"
        >
          <span>Enter a private gathering</span>
          <span className="font-mono text-xs tracking-widest">
            + Use invite code
          </span>
        </button>
      ) : (
        <div className="rounded-[32px] bg-white/60 backdrop-blur-3xl p-6 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="event-code" className="label-xs text-muted">
                Private event code
              </label>
              <input
                ref={inputRef}
                id="event-code"
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="Paste the private invite code"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Persona selector */}
            <div className="space-y-1.5">
              <label htmlFor="event-persona" className="label-xs text-muted">
                Arrive as
              </label>
              {personasLoading ? (
                <div className="h-12 animate-pulse rounded-2xl bg-foreground/[0.03] dark:bg-white/[0.045]" />
              ) : personas.length === 0 ? (
                <p className="text-xs text-muted">
                  No personas found. Create one first.
                </p>
              ) : (
                <CustomSelect
                  id="event-persona"
                  value={selectedPersonaId}
                  onChange={(value) => setSelectedPersonaId(value)}
                  className={inputCls}
                  options={personas.map((p) => ({
                    value: p.id,
                    label: `${p.fullName} · ${p.jobTitle}`,
                  }))}
                />
              )}
            </div>

            {error ? (
              <div className="rounded-2xl bg-rose-500/5 px-4 py-3 ring-1 ring-inset ring-rose-500/20">
                <p className="font-mono text-sm text-rose-600 dark:text-rose-400">
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
                {isSubmitting ? "Joining…" : "Join gathering"}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setEventCode("");
                  setError(null);
                }}
                className="rounded-2xl bg-foreground/[0.04] px-5 py-3 text-sm font-semibold text-muted shadow-inner ring-1 ring-black/5 transition-all hover:bg-foreground/[0.06] hover:text-foreground active:scale-95 dark:bg-white/[0.05] dark:ring-white/10"
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

export function EventsScreen({ user }: { user: UserProfile }) {
  const router = useRouter();
  const initialCacheRef = useRef(
    readSessionCache<EventSummary[]>(EVENTS_CACHE_KEY),
  );
  const [events, setEvents] = useState<EventSummary[]>(
    () => initialCacheRef.current ?? [],
  );
  const [isLoading, setIsLoading] = useState(
    () => initialCacheRef.current === null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    writeSessionCache(EVENTS_CACHE_KEY, events);
  }, [events]);

  useEffect(() => {
    let cancelled = false;

    if (initialCacheRef.current === null) {
      setIsLoading(true);
    }

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
          return;
        }

        if (!cancelled)
          setLoadError(
            err instanceof Error ? err.message : "Unable to load gatherings.",
          );
      })
      .finally(() => {
        if (!cancelled && initialCacheRef.current === null) {
          setIsLoading(false);
        }
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
    return (
      <EmptyState title="Could not load gatherings" description={loadError} />
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <JoinPanel onJoined={handleJoined} user={user} />

      {events.length === 0 ? (
        <EmptyState
          title="No gatherings yet"
          description="Join with the private code or invitation link shared by the host."
        />
      ) : (
        events.map((event) => <EventCard key={event.id} event={event} />)
      )}
    </div>
  );
}
