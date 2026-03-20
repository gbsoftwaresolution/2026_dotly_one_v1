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
      className="flex w-full flex-col space-y-4 rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all active:scale-[0.98] dark:border-zinc-900 dark:bg-zinc-950"
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
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
            Refreshing
          </p>
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
              <div className="h-2 w-full rounded bg-slate-100 dark:bg-zinc-900" />
              <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-muted">
                Views
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                {analytics.profileViews}
              </p>
            </div>
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-muted">
                Scans
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                {analytics.qrScans}
              </p>
            </div>
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-muted">
                Conversion
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                {conversionRate}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-muted">
                Requests
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {analytics.requestsReceived}
              </p>
            </div>
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-widest text-muted">
                Approved
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {analytics.requestsApproved}
              </p>
            </div>
          </div>

          {/* Performance Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-900">
            <div
              className="h-full rounded-full bg-brandRose transition-all duration-500 dark:bg-brandCyan"
              style={{ width: `${Math.min(conversionNum, 100)}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
