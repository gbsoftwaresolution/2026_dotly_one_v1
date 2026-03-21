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
    hour: "numeric",
    minute: "2-digit",
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
    return <StatusBadge label="Expired" tone="neutral" dot />;
  }

  const nearExpiry = isNearExpiry(accessEndAt);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StatusBadge
        label="TEMP"
        tone={nearExpiry ? "warning" : "cyan"}
        dot={nearExpiry}
      />
      <span className="font-mono text-[10px] text-muted">
        Expires {formatDate(accessEndAt)}
      </span>
    </div>
  );
}
