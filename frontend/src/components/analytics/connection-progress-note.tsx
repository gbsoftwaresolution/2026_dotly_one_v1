import { cn } from "@/lib/utils/cn";
import type { CurrentUserAnalytics } from "@/types/analytics";

function formatPeopleLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "person" : "people"}`;
}

interface ConnectionProgressNoteProps {
  analytics: CurrentUserAnalytics | null;
  className?: string;
}

export function ConnectionProgressNote({
  analytics,
  className,
}: ConnectionProgressNoteProps) {
  if (!analytics) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-black/[0.06] bg-white/72 px-4 py-3 text-center shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-white/[0.08] dark:bg-white/[0.04]",
        className,
      )}
    >
      {analytics.totalConnections > 0 ? (
        <p className="text-sm leading-6 text-muted">
          You&apos;ve connected with{" "}
          <span className="font-semibold text-foreground">
            {formatPeopleLabel(analytics.totalConnections)}
          </span>
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted">
          Your next scan could become your first connection.
        </p>
      )}

      {analytics.connectionsThisMonth > 0 ? (
        <p className="mt-1 text-xs font-semibold tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
          +{analytics.connectionsThisMonth.toLocaleString()} this month
        </p>
      ) : null}
    </div>
  );
}
