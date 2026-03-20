import { Card } from "@/components/shared/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { IncomingRequest, OutgoingRequest } from "@/types/request";

function formatSourceType(sourceType: IncomingRequest["sourceType"]): string {
  switch (sourceType) {
    case "qr":
      return "QR";
    case "event":
      return "Event";
    case "profile":
    default:
      return "Profile";
  }
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusTone(status: OutgoingRequest["status"]) {
  switch (status) {
    case "approved":
      return "success" as const;
    case "rejected":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

interface IncomingRequestCardProps {
  request: IncomingRequest;
  isApproving?: boolean;
  isRejecting?: boolean;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export function IncomingRequestCard({
  request,
  isApproving = false,
  isRejecting = false,
  onApprove,
  onReject,
}: IncomingRequestCardProps) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        {request.fromPersona.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={request.fromPersona.profilePhotoUrl}
            alt={request.fromPersona.fullName}
            className="h-12 w-12 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            {request.fromPersona.fullName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-base font-semibold text-foreground">
              {request.fromPersona.fullName}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {formatTimestamp(request.createdAt)}
            </span>
          </div>
          <p className="text-sm text-muted">
            {request.fromPersona.jobTitle} at {request.fromPersona.companyName}
          </p>
          <div className="flex items-center gap-2">
            <StatusBadge label={formatSourceType(request.sourceType)} />
            <span className="text-xs text-muted">
              @{request.fromPersona.username}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-50/80 px-4 py-3 dark:bg-zinc-900/50">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Reason
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          {request.reason?.trim() || "No reason added."}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          className="flex h-[60px] flex-1 items-center justify-center rounded-2xl bg-slate-100 px-5 text-sm font-bold text-slate-900 transition-all hover:bg-slate-200 active:scale-95 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          disabled={isApproving || isRejecting}
          onClick={() => onReject(request.id)}
        >
          {isRejecting ? "Rejecting..." : "Reject"}
        </button>
        <button
          className="flex h-[60px] flex-1 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          disabled={isApproving || isRejecting}
          onClick={() => onApprove(request.id)}
        >
          {isApproving ? "Approving..." : "Approve"}
        </button>
      </div>
    </Card>
  );
}

interface OutgoingRequestCardProps {
  request: OutgoingRequest;
}

export function OutgoingRequestCard({ request }: OutgoingRequestCardProps) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        {request.toPersona.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={request.toPersona.profilePhotoUrl}
            alt={request.toPersona.fullName}
            className="h-12 w-12 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            {request.toPersona.fullName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-base font-semibold text-foreground">
              {request.toPersona.fullName}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {formatTimestamp(request.createdAt)}
            </span>
          </div>
          <p className="text-sm text-muted">
            {request.toPersona.jobTitle} at {request.toPersona.companyName}
          </p>
          <div className="flex items-center gap-2">
            <StatusBadge
              label={request.status}
              tone={getStatusTone(request.status)}
            />
            <span className="text-xs text-muted">
              @{request.toPersona.username}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-50/80 px-4 py-3 dark:bg-zinc-900/50">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Reason
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          {request.reason?.trim() || "No reason added."}
        </p>
      </div>
    </Card>
  );
}
