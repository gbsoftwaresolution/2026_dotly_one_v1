import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { routes } from "@/lib/constants/routes";
import type { EventStatus, EventSummary } from "@/types/event";

interface EventCardProps {
  event: EventSummary;
}

function statusBadgeProps(status: EventStatus): {
  label: string;
  tone: "neutral" | "success" | "warning";
} {
  switch (status) {
    case "live":
      return { label: "Live", tone: "success" };
    case "upcoming":
      return { label: "Upcoming", tone: "warning" };
    case "ended":
      return { label: "Ended", tone: "neutral" };
  }
}

function formatEventTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateStr = start.toLocaleDateString("en-US", {
    month: "short",
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

export function EventCard({ event }: EventCardProps) {
  const badge = statusBadgeProps(event.status);

  return (
    <Link href={routes.app.eventDetail(event.id)} className="block">
      <div className="rounded-3xl bg-white/80 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-all duration-500 ease-[0.16,1,0.3,1] hover:scale-[0.995] hover:bg-foreground/[0.02] active:scale-[0.98] motion-safe:animate-[fade-in_420ms_ease-out] dark:bg-zinc-950/80 dark:ring-white/[0.06] dark:hover:bg-white/[0.04]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-base font-semibold text-foreground">
              {event.name}
            </p>
            <p className="font-mono text-xs text-muted">
              {formatEventTime(event.startsAt, event.endsAt)}
            </p>
            {event.location ? (
              <p className="font-mono text-xs text-muted">{event.location}</p>
            ) : null}
          </div>
          <div className="shrink-0 pt-0.5">
            <StatusBadge label={badge.label} tone={badge.tone} />
          </div>
        </div>

        {event.myParticipation ? (
          <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
            <p className="font-mono text-xs text-muted">
              Attending as{" "}
              <span className="font-medium capitalize text-foreground">
                {event.myParticipation.role}
              </span>
              {event.myParticipation.discoverable ? (
                <span className="ml-2 text-foreground/80">· Broadcasting</span>
              ) : (
                <span className="ml-2 text-muted">· Stealth</span>
              )}
            </p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
