import { notFound } from "next/navigation";

import { ContactFollowUpForm } from "@/components/follow-ups/contact-follow-up-form";
import { NoteEditor } from "@/components/contacts/note-editor";
import { RelationshipActions } from "@/components/contacts/relationship-actions";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiError, apiRequest } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import { formatConnectionContext } from "@/lib/utils/format-contact-relationship";
import type { ContactDetail } from "@/types/contact";

const DAY = 1000 * 60 * 60 * 24;

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatConnectionDate(value: string): string {
  const date = new Date(value);
  const includeYear = date.getFullYear() !== new Date().getFullYear();

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(date);
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp) || timestamp > Date.now()) {
    return null;
  }

  return timestamp;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatRelativeOrDate(value: string | null | undefined): string | null {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return null;
  }

  const dayDifference = Math.floor(
    (startOfDay(Date.now()) - startOfDay(timestamp)) / DAY,
  );

  if (dayDifference <= 0) {
    return "today";
  }

  if (dayDifference === 1) {
    return "1 day ago";
  }

  if (dayDifference < 7) {
    return `${dayDifference} days ago`;
  }

  return `on ${formatConnectionDate(value!)}`;
}

function formatConnectionLine(connectedAt: string | null | undefined): string {
  const relativeLabel = formatRelativeOrDate(connectedAt);

  return relativeLabel ? `Connected ${relativeLabel}` : "Connected";
}

function formatLastInteractionLine(
  lastInteractionAt: string | null | undefined,
): string | null {
  const relativeLabel = formatRelativeOrDate(lastInteractionAt);

  return relativeLabel ? `Last interaction ${relativeLabel}` : null;
}

function formatTitleLine(jobTitle: string, companyName: string): string | null {
  const parts = [jobTitle, companyName]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    return parts[0] ?? null;
  }

  return `${parts[0]} at ${parts[1]}`;
}

function getStateBadge(state: ContactDetail["state"]) {
  switch (state) {
    case "instant_access":
      return <StatusBadge label="Instant Access" tone="warning" />;
    case "expired":
      return <StatusBadge label="Expired" tone="neutral" />;
    case "approved":
    default:
      return <StatusBadge label="Approved" tone="success" />;
  }
}

function ConnectionLine({ children }: { children: string }) {
  return (
    <p className="font-sans text-sm leading-6 text-foreground/85 sm:text-[15px]">
      {children}
    </p>
  );
}

function ConnectionSection({
  summary,
  connectedLine,
  lastInteractionLine,
}: {
  summary: string;
  connectedLine: string;
  lastInteractionLine: string | null;
}) {
  return (
    <Card>
      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-sans text-lg font-semibold text-foreground">
            Connection
          </h2>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface/50 px-4 py-4">
          <div className="space-y-2">
            <ConnectionLine>{summary}</ConnectionLine>
            <ConnectionLine>{connectedLine}</ConnectionLine>
            {lastInteractionLine ? (
              <ConnectionLine>{lastInteractionLine}</ConnectionLine>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ relationshipId: string }>;
}) {
  const { relationshipId } = await params;
  const { accessToken } = await requireServerSession(
    routes.app.contactDetail(relationshipId),
  );

  let contact: ContactDetail | null = null;
  let loadError: string | null = null;

  try {
    contact = await apiRequest<ContactDetail>(`/contacts/${relationshipId}`, {
      token: accessToken,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 403 || error.status === 404)
    ) {
      notFound();
    }

    loadError =
      error instanceof ApiError
        ? error.message
        : "We could not load this contact right now.";
  }

  if (loadError) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Contact unavailable"
          description="This relationship record cannot be loaded right now."
        />
        <Card className="space-y-2 border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30">
          <h2 className="font-sans text-lg font-semibold text-rose-700 dark:text-rose-300">
            Unable to load contact
          </h2>
          <p className="font-sans text-sm leading-6 text-rose-700 dark:text-rose-300">
            {loadError}
          </p>
        </Card>
      </section>
    );
  }

  if (!contact) {
    notFound();
  }

  const {
    targetPersona,
    connectedAt,
    connectionSource,
    contextLabel,
    memory,
    state,
    accessEndAt,
    lastInteractionAt,
    isExpired,
    metadata,
  } = contact;

  const resolvedLastInteractionAt =
    metadata.lastInteractionAt ?? lastInteractionAt;
  const connectionSummary = formatConnectionContext(
    connectionSource,
    contextLabel,
    contact.sourceType,
  );
  const connectedLine = formatConnectionLine(connectedAt);
  const lastInteractionLine = formatLastInteractionLine(
    resolvedLastInteractionAt,
  );
  const titleLine = formatTitleLine(
    targetPersona.jobTitle,
    targetPersona.companyName,
  );

  return (
    <section className="space-y-4">
      <PageHeader
        title={targetPersona.fullName}
        description={titleLine ?? "Connection details and context"}
      />

      {state === "instant_access" && !isExpired && (
        <div className="rounded-2xl border border-brandRose/50 bg-brandRose/10 px-4 py-3 dark:border-brandCyan/50 dark:bg-brandCyan/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-pulse">
          <p className="font-mono text-xs font-bold text-brandRose dark:text-brandCyan uppercase tracking-widest flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brandRose dark:bg-brandCyan opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brandRose dark:bg-brandCyan"></span>
            </span>
            Live connection window
          </p>
          {accessEndAt && (
            <p className="font-mono text-[11px] text-brandRose/80 dark:text-brandCyan/80 font-medium">
              Expires {formatTimestamp(accessEndAt)}
            </p>
          )}
        </div>
      )}
      {isExpired && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center justify-between">
          <p className="font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
            Connection window closed
          </p>
        </div>
      )}

      <Card className="space-y-6">
        <div className="flex items-start gap-4 pt-1 sm:gap-5">
          {targetPersona.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={targetPersona.profilePhotoUrl}
              alt={targetPersona.fullName}
              className="h-20 w-20 rounded-3xl object-cover shadow-sm sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-slate-900 text-2xl font-semibold text-white shadow-sm dark:bg-white dark:text-zinc-950 sm:h-24 sm:w-24 sm:text-3xl">
              {targetPersona.fullName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-1">
              <h2 className="font-sans text-xl font-bold text-foreground">
                {targetPersona.fullName}
              </h2>
              <p className="font-sans text-sm text-muted">
                @{targetPersona.username}
              </p>
              {titleLine ? (
                <p className="font-sans text-sm text-foreground/85">
                  {titleLine}
                </p>
              ) : null}
              {targetPersona.tagline ? (
                <p className="font-sans text-sm italic text-muted">
                  &ldquo;{targetPersona.tagline}&rdquo;
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {getStateBadge(state)}
              {metadata.isRecentlyActive ? (
                <StatusBadge label="Recently active" tone="neutral" dot />
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4" id="private-note">
          <div className="space-y-1">
            <h2 className="font-sans text-lg font-semibold text-foreground">
              Private note
            </h2>
            <p className="font-sans text-sm text-muted">
              Capture the one thing you will want to remember later.
            </p>
          </div>
          <NoteEditor
            relationshipId={relationshipId}
            initialNote={memory.note}
            disabled={isExpired}
          />
        </div>
      </Card>

      <ConnectionSection
        summary={connectionSummary}
        connectedLine={connectedLine}
        lastInteractionLine={lastInteractionLine}
      />

      <Card>
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-sans text-lg font-semibold text-foreground">
              Follow-up
            </h2>
            <p className="font-sans text-sm text-muted">
              Keep the next reconnection easy to pick back up.
            </p>
          </div>

          <ContactFollowUpForm
            relationshipId={relationshipId}
            contactName={targetPersona.fullName}
            initialFollowUpSummary={contact.followUpSummary}
            disabled={isExpired}
          />
          {isExpired ? (
            <p className="font-sans text-xs text-muted">
              Follow-ups are unavailable because this connection window has
              closed.
            </p>
          ) : null}
        </div>
      </Card>

      <RelationshipActions
        relationshipId={relationshipId}
        initialState={state}
        isExpired={isExpired}
        targetPersonaId={targetPersona.id}
        displayName={targetPersona.fullName}
      />
    </section>
  );
}
