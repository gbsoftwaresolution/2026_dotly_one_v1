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
      return { label: "Live now", tone: "success" };
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
      <div className="rounded-[32px] bg-white/60 backdrop-blur-3xl p-6 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 transition-all duration-500 hover:-translate-y-1 hover:bg-white/80 dark:bg-zinc-900/60 dark:ring-white/10 dark:hover:bg-zinc-800/80">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-xl tracking-tight font-bold text-foreground">
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
              Present as{" "}
              <span className="font-medium capitalize text-foreground">
                {event.myParticipation.role}
              </span>
              {event.myParticipation.discoverable ? (
                <span className="ml-2 text-foreground/80">· Visible</span>
              ) : (
                <span className="ml-2 text-muted">· Private</span>
              )}
            </p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
