import Link from "next/link";

import { Card } from "@/components/shared/card";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { routes } from "@/lib/constants/routes";
import { formatTimeAgoShort, isRecentTimestamp } from "@/lib/utils/format-time-ago";
import type { Contact } from "@/types/contact";

function formatSourceType(sourceType: Contact["sourceType"]): string {
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getStateBadge(contact: Contact) {
  switch (contact.state) {
    case "instant_access":
      return <StatusBadge label="Instant Access" tone="warning" />;
    case "expired":
      return <StatusBadge label="Expired" tone="neutral" />;
    case "approved":
    default:
      return <StatusBadge label="Approved" tone="success" />;
  }
}

function isNearExpiry(accessEndAt: string): boolean {
  const hoursUntilExpiry =
    (new Date(accessEndAt).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilExpiry <= 24;
}

interface ContactCardProps {
  contact: Contact;
}

export function ContactCard({ contact }: ContactCardProps) {
  const {
    targetPersona,
    sourceType,
    createdAt,
    relationshipId,
    state,
    accessEndAt,
    lastInteractionAt,
  } = contact;

  const nearExpiry =
    state === "instant_access" &&
    accessEndAt !== null &&
    accessEndAt !== undefined
      ? isNearExpiry(accessEndAt)
      : false;

  const recentInteractionLabel = lastInteractionAt
    ? formatTimeAgoShort(lastInteractionAt)
    : null;
  const showRecentInteraction =
    recentInteractionLabel !== null && isRecentTimestamp(lastInteractionAt, 14);

  return (
    <Link
      href={routes.app.contactDetail(relationshipId)}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brandRose dark:focus-visible:ring-brandCyan rounded-3xl"
    >
      <Card
        className={`space-y-4 transition-all hover:bg-slate-50/50 active:scale-[0.99] dark:hover:bg-zinc-900/50 ${
          nearExpiry
            ? "border-amber-400/40 dark:border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.12)]"
            : ""
        }`}
      >
        <div className="flex items-start gap-4">
          {targetPersona.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={targetPersona.profilePhotoUrl}
              alt={targetPersona.fullName}
              className="h-14 w-14 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white"
              style={{
                background: `hsl(${((targetPersona.username?.charCodeAt(0) ?? 72) * 137) % 360}, 60%, 45%)`,
              }}
            >
              {targetPersona.fullName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1 pt-1">
            <h2 className="truncate font-sans text-base font-semibold text-foreground">
              {targetPersona.fullName}
            </h2>
            <p className="truncate font-sans text-sm text-muted">
              {targetPersona.jobTitle} at {targetPersona.companyName}
            </p>
            {state === "instant_access" && accessEndAt && (
              <div className="pt-0.5">
                <ExpiryBadge accessEndAt={accessEndAt} isExpired={false} />
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-2 pt-1 text-right">
            <div>{getStateBadge(contact)}</div>
            {showRecentInteraction ? (
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                {recentInteractionLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-widest text-muted flex-wrap">
          <span>Via {formatSourceType(sourceType)}</span>
          <span>Connected {formatDate(createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
