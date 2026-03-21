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
      <div className="glass rounded-3xl border border-border bg-surface p-5 transition-all hover:border-brandRose/40 dark:hover:border-brandCyan/40 active:scale-[0.98]">
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
          <div className="mt-3 border-t border-border pt-3">
            <p className="font-mono text-xs text-muted">
              Attending as{" "}
              <span className="font-medium capitalize text-foreground">
                {event.myParticipation.role}
              </span>
              {event.myParticipation.discoverable ? (
                <span className="ml-2 text-brandRose dark:text-brandCyan">
                  · Broadcasting
                </span>
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
