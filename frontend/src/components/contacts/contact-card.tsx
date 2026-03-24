import Link from "next/link";

import { Card } from "@/components/shared/card";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getPassiveReminderBadgeLabel,
  getPassiveReminderBody,
} from "@/lib/follow-ups/passive-reminder";
import { routes } from "@/lib/constants/routes";
import {
  formatConnectionContext,
  formatRelationshipAge,
  getRecentActivityLabel,
} from "@/lib/utils/format-contact-relationship";
import { cn } from "@/lib/utils/cn";
import type { Contact } from "@/types/contact";

function summarizeNote(note: string): string {
  const normalized = note.replace(/\s+/g, " ").trim();

  if (normalized.length <= 96) {
    return normalized;
  }

  return `${normalized.slice(0, 93).trimEnd()}...`;
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
  hasPassiveReminder?: boolean;
}

export function ContactCard({
  contact,
  hasPassiveReminder = false,
}: ContactCardProps) {
  const {
    targetPersona,
    connectedAt,
    connectionSource,
    contextLabel,
    relationshipId,
    state,
    accessEndAt,
    lastInteractionAt,
    metadata,
    memory,
  } = contact;

  const nearExpiry =
    state === "instant_access" &&
    accessEndAt !== null &&
    accessEndAt !== undefined
      ? isNearExpiry(accessEndAt)
      : false;

  const recentActivityLabel = getRecentActivityLabel(
    metadata.isRecentlyActive,
    metadata.lastInteractionAt ?? lastInteractionAt,
  );
  const relationshipAgeLabel = formatRelationshipAge(
    metadata.relationshipAgeDays,
    connectedAt,
    "compact",
  );
  const titleLine = [targetPersona.jobTitle, targetPersona.companyName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" at ");
  const sourceContext = formatConnectionContext(
    connectionSource,
    contextLabel,
  );

  return (
    <Link
      href={routes.app.contactDetail(relationshipId)}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brandRose dark:focus-visible:ring-brandCyan rounded-3xl"
    >
      <Card
        className={cn(
          "space-y-4 transition-all hover:bg-slate-50/50 active:scale-[0.99] dark:hover:bg-zinc-900/50",
          nearExpiry &&
            "border-amber-400/40 dark:border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.12)]",
          hasPassiveReminder &&
            !nearExpiry &&
            "border-cyan-200/80 bg-cyan-50/40 dark:border-brandCyan/20 dark:bg-brandCyan/[0.07]",
        )}
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
            {titleLine ? (
              <p className="truncate font-sans text-sm text-muted">
                {titleLine}
              </p>
            ) : null}
            <p className="truncate font-sans text-xs text-muted/90">
              {sourceContext}
            </p>
            {state === "instant_access" && accessEndAt && (
              <div className="pt-0.5">
                <ExpiryBadge accessEndAt={accessEndAt} isExpired={false} />
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-2 pt-1 text-right">
            <div>{getStateBadge(contact)}</div>
            {recentActivityLabel ? (
              <StatusBadge label={recentActivityLabel} tone="neutral" dot />
            ) : null}
          </div>
        </div>

        {hasPassiveReminder ? (
          <div className="rounded-2xl border border-cyan-200/80 bg-cyan-50/70 px-4 py-3 dark:border-brandCyan/20 dark:bg-brandCyan/[0.08]">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-cyan-700 dark:text-brandCyan">
              {getPassiveReminderBadgeLabel()}
            </p>
            <p className="mt-1 font-sans text-xs leading-5 text-cyan-900 dark:text-white/78">
              {getPassiveReminderBody()}
            </p>
          </div>
        ) : null}

        {memory.note ? (
          <div className="rounded-2xl border border-border/80 bg-surface/70 px-4 py-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Private note
            </p>
            <p className="mt-1 font-sans text-sm leading-6 text-foreground/85">
              {summarizeNote(memory.note)}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-slate-600 dark:bg-white/[0.06] dark:text-white/60">
            Connected {relationshipAgeLabel}
          </span>
          <span className="font-sans text-xs text-muted">
            Since {formatDate(connectedAt)}
          </span>
          {metadata.isRecentlyActive && !recentActivityLabel ? (
            <span className="font-sans text-xs text-muted">
              Recently active
            </span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
