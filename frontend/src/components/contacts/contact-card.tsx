import Link from "next/link";

import { Card } from "@/components/shared/card";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { StatusBadge } from "@/components/shared/status-badge";
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
      return <StatusBadge label="Connected now" tone="warning" />;
    case "expired":
      return <StatusBadge label="Connection closed" tone="neutral" />;
    case "approved":
    default:
      return <StatusBadge label="Connected" tone="success" />;
  }
}

function isNearExpiry(accessEndAt: string): boolean {
  const hoursUntilExpiry =
    (new Date(accessEndAt).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilExpiry <= 24;
}

type ContactCardPriorityTone = "attention" | "recent" | "planned";

interface ContactCardProps {
  contact: Contact;
  hasPassiveReminder?: boolean;
  priorityLabel?: string;
  priorityTone?: ContactCardPriorityTone;
}

export function ContactCard({
  contact,
  hasPassiveReminder = false,
  priorityLabel,
  priorityTone,
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
  const sourceContext = formatConnectionContext(connectionSource, contextLabel);
  const fallbackPriorityTone = hasPassiveReminder ? "attention" : undefined;
  const resolvedPriorityTone = priorityTone ?? fallbackPriorityTone;

  return (
    <Link
      href={routes.app.contactDetail(relationshipId)}
      className="block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
    >
      <Card
        className={cn(
          "space-y-4 transition-all duration-500 ease-[0.16,1,0.3,1] hover:scale-[0.995] hover:bg-foreground/[0.02] active:scale-[0.99] dark:hover:bg-white/[0.04] motion-safe:animate-[fade-in_420ms_ease-out]",
          nearExpiry &&
            "border-amber-400/40 dark:border-amber-500/30 shadow-[0_0_20px_rgba(251,191,36,0.12)]",
          !nearExpiry &&
            resolvedPriorityTone === "attention" &&
            "border-rose-200/80 bg-rose-50/50 dark:border-rose-300/15 dark:bg-rose-300/[0.05]",
          !nearExpiry &&
            resolvedPriorityTone === "recent" &&
            "border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-300/15 dark:bg-emerald-300/[0.05]",
          !nearExpiry &&
            resolvedPriorityTone === "planned" &&
            "border-sky-200/80 bg-sky-50/40 dark:border-sky-300/15 dark:bg-sky-300/[0.05]",
          !nearExpiry &&
            !resolvedPriorityTone &&
            hasPassiveReminder &&
            !nearExpiry &&
            "border-black/5 bg-foreground/[0.04] dark:border-white/10 dark:bg-white/[0.06]",
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
            {priorityLabel ? (
              <p
                className={cn(
                  "font-mono text-[10px] font-semibold uppercase tracking-widest",
                  resolvedPriorityTone === "attention"
                    ? "text-rose-700 dark:text-rose-300"
                    : resolvedPriorityTone === "planned"
                      ? "text-sky-700 dark:text-sky-300"
                      : "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {priorityLabel}
              </p>
            ) : null}
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

        {memory.note ? (
          <div className="rounded-2xl bg-foreground/[0.03] px-4 py-3 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Private note
            </p>
            <p className="mt-1 font-sans text-sm leading-6 text-foreground/85">
              {summarizeNote(memory.note)}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
          <span className="rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted dark:bg-white/[0.06] dark:text-white/60">
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
