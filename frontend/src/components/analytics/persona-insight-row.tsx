import type { PersonaAnalytics } from "@/types/analytics";
import type { PersonaSummary } from "@/types/persona";

export interface PersonaWithAnalytics {
  persona: PersonaSummary;
  analytics: PersonaAnalytics | null;
  error: string | null;
  isRefreshing?: boolean;
}

interface PersonaInsightRowProps extends PersonaWithAnalytics {
  onClick?: () => void;
}

export function PersonaInsightRow({
  persona,
  analytics,
  error,
  isRefreshing,
  onClick,
}: PersonaInsightRowProps) {
  const conversionRate =
    analytics !== null ? analytics.conversionRate.toFixed(2) : "0.00";
  const conversionNum = analytics?.conversionRate ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col space-y-4 rounded-3xl border border-border bg-surface p-5 text-left shadow-sm transition-all active:scale-[0.98] hover:border-brandRose/30 hover:bg-brandRose/5 dark:hover:border-brandCyan/30 dark:hover:bg-brandCyan/5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-sans text-sm font-semibold text-foreground">
            {persona.fullName}
          </p>
          <p className="mt-0.5 font-sans text-xs text-muted">
            {persona.jobTitle} • @{persona.username}
          </p>
        </div>
        {isRefreshing ? (
          <p className="label-xs text-muted">Refreshing</p>
        ) : null}
      </div>

      {error ? (
        <p className="font-mono text-xs text-rose-500 dark:text-rose-400">
          {error}
        </p>
      ) : analytics === null ? (
        <div className="grid w-full grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-1">
              <div className="h-2 w-full rounded-full bg-current opacity-10" />
              <div className="h-4 w-2/3 rounded-full bg-current opacity-10" />
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="label-xs text-muted">Views</p>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">
                {analytics.profileViews}
              </p>
            </div>
            <div>
              <p className="label-xs text-muted">Scans</p>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">
                {analytics.qrScans}
              </p>
            </div>
            <div>
              <p className="label-xs text-muted">Conv.</p>
              <p className="mt-1 font-mono text-lg font-bold text-brandRose dark:text-brandCyan">
                {conversionRate}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label-xs text-muted">Requests</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {analytics.requestsReceived}
              </p>
            </div>
            <div>
              <p className="label-xs text-muted">Approved</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {analytics.requestsApproved}
              </p>
            </div>
          </div>

          {/* Performance Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brandRose to-brandRose/70 transition-all duration-700 dark:from-brandCyan dark:to-brandCyan/70"
              style={{ width: `${Math.min(conversionNum, 100)}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
