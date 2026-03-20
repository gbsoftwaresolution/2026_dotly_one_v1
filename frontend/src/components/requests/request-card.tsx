import { Card } from "@/components/shared/card";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { StatusBadge } from "@/components/shared/status-badge";
import type { IncomingRequest, OutgoingRequest } from "@/types/request";

function formatSourceType(sourceType: IncomingRequest["sourceType"]): string {
  return sourceType === "qr" ? "QR" : "Profile";
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
            <h2 className="text-base font-semibold text-foreground">
              {request.fromPersona.fullName}
            </h2>
            <span className="text-xs text-muted">
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

      <div className="rounded-2xl border border-border bg-slate-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Reason
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground">
          {request.reason?.trim() || "No reason added."}
        </p>
      </div>

      <div className="flex gap-3">
        <PrimaryButton
          className="w-full"
          disabled={isApproving || isRejecting}
          onClick={() => onApprove(request.id)}
        >
          {isApproving ? "Approving..." : "Approve"}
        </PrimaryButton>
        <SecondaryButton
          className="w-full"
          disabled={isApproving || isRejecting}
          onClick={() => onReject(request.id)}
        >
          {isRejecting ? "Rejecting..." : "Reject"}
        </SecondaryButton>
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
            <h2 className="text-base font-semibold text-foreground">
              {request.toPersona.fullName}
            </h2>
            <span className="text-xs text-muted">
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

      <div className="rounded-2xl border border-border bg-slate-50/80 px-4 py-3">
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
