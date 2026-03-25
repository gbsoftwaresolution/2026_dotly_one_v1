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
        "rounded-[1.5rem] bg-white/40 px-4 py-3 text-center shadow-sm ring-1 ring-black/5 dark:bg-zinc-800/40 dark:ring-white/10 backdrop-blur-md",
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
