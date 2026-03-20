import { StatusBadge } from "./status-badge";

interface ExpiryBadgeProps {
  accessEndAt: string | null;
  isExpired: boolean;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function isNearExpiry(accessEndAt: string): boolean {
  const hoursUntilExpiry =
    (new Date(accessEndAt).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilExpiry > 0 && hoursUntilExpiry <= 24;
}

export function ExpiryBadge({ accessEndAt, isExpired }: ExpiryBadgeProps) {
  if (!accessEndAt) return null;

  if (isExpired) {
    return <StatusBadge label="Expired" tone="neutral" />;
  }

  const nearExpiry = isNearExpiry(accessEndAt);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest bg-brandRose/10 text-brandRose dark:bg-brandCyan/10 dark:text-brandCyan ${
          nearExpiry ? "animate-pulse" : ""
        }`}
      >
        {nearExpiry && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brandRose dark:bg-brandCyan opacity-75"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brandRose dark:bg-brandCyan"></span>
          </span>
        )}
        TEMP
      </span>
      <span className="font-mono text-[10px] text-muted">
        Expires {formatDate(accessEndAt)}
      </span>
    </div>
  );
}
