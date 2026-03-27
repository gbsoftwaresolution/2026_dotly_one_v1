import { notFound } from "next/navigation";

import { NoteEditor } from "@/components/contacts/note-editor";
import { QuickInteractionPanel } from "@/components/contacts/quick-interaction-panel";
import { RelationshipActions } from "@/components/contacts/relationship-actions";
import { ContactFollowUpForm } from "@/components/follow-ups/contact-follow-up-form";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiError, apiRequest } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import { formatConnectionContext } from "@/lib/utils/format-contact-relationship";
import type {
  ContactDetail,
  RelationshipActivityTimelineEvent,
} from "@/types/contact";

const DAY = 1000 * 60 * 60 * 24;
const ACTIVITY_EVENT_LIMIT = 5;

interface ActivityEvent {
  id: string;
  label: string;
  timeLabel: string;
  timestamp: number;
}

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

function formatActivityTime(value: string | null | undefined): string | null {
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
    return "yesterday";
  }

  if (dayDifference < 7) {
    return `${dayDifference} days ago`;
  }

  return formatConnectionDate(value!);
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

function buildActivityEvents(
  timeline: RelationshipActivityTimelineEvent[],
): ActivityEvent[] {
  return timeline
    .flatMap((event) => {
      const timeLabel = formatActivityTime(event.timestamp);
      const timestamp = parseTimestamp(event.timestamp);

      if (!timeLabel || timestamp === null) {
        return [];
      }

      return [
        {
          id: event.id,
          label: event.label,
          timeLabel,
          timestamp,
        },
      ];
    })
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, ACTIVITY_EVENT_LIMIT);
}

function getStateBadge(state: ContactDetail["state"]) {
  switch (state) {
    case "instant_access":
      return <StatusBadge label="Connected now" tone="warning" />;
    case "expired":
      return <StatusBadge label="Connection closed" tone="neutral" />;
    case "approved":
    default:
      return <StatusBadge label="Connected" tone="success" />;
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

        <div className="rounded-2xl bg-foreground/[0.03] px-4 py-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.045] dark:ring-white/5">
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

function ActivitySection({
  events,
  loadError,
}: {
  events: ActivityEvent[];
  loadError: string | null;
}) {
  return (
    <Card>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-sans text-lg font-semibold text-foreground">
            Activity
          </h2>
          <p className="font-sans text-sm text-muted">
            The latest moments that matter in this connection.
          </p>
        </div>

        {loadError ? (
          <p className="font-sans text-sm text-muted">{loadError}</p>
        ) : events.length === 0 ? (
          <p className="font-sans text-sm text-muted">No activity yet</p>
        ) : (
          <ul className="divide-y divide-black/5 rounded-2xl bg-foreground/[0.03] px-4 shadow-inner ring-1 ring-inset ring-black/5 dark:divide-white/10 dark:bg-white/[0.045] dark:ring-white/5">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="font-sans text-sm leading-6 text-foreground/85">
                  {event.label}
                </span>
                <span className="shrink-0 font-sans text-xs text-muted">
                  {event.timeLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
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
  let timeline: RelationshipActivityTimelineEvent[] = [];
  let loadError: string | null = null;
  let activityLoadError: string | null = null;

  try {
    const [contactResult, timelineResult] = await Promise.allSettled([
      apiRequest<ContactDetail>(`/contacts/${relationshipId}`, {
        token: accessToken,
      }),
      apiRequest<RelationshipActivityTimelineEvent[]>(
        `/relationships/${relationshipId}/timeline`,
        {
          token: accessToken,
        },
      ),
    ]);

    if (contactResult.status === "rejected") {
      throw contactResult.reason;
    }

    contact = contactResult.value;

    if (timelineResult.status === "fulfilled") {
      timeline = timelineResult.value;
    } else {
      const error = timelineResult.reason;

      if (
        error instanceof ApiError &&
        (error.status === 403 || error.status === 404)
      ) {
        notFound();
      }

      activityLoadError = "We could not load the latest story right now.";
    }
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
  const activityEvents = buildActivityEvents(timeline);

  return (
    <section className="space-y-4">
      <PageHeader
        title={targetPersona.fullName}
        description={titleLine ?? "Connection details and context"}
      />

      {state === "instant_access" && !isExpired && (
        <div className="flex flex-col justify-between gap-2 rounded-2xl bg-foreground/[0.04] px-4 py-3 shadow-inner ring-1 ring-inset ring-black/5 animate-pulse dark:bg-white/[0.05] dark:ring-white/10 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-foreground/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/60 opacity-75 dark:bg-white/70"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/75 dark:bg-white"></span>
            </span>
            Live connection window
          </p>
          {accessEndAt && (
            <p className="font-mono text-[11px] font-medium text-muted">
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
        <QuickInteractionPanel
          relationshipId={relationshipId}
          disabled={isExpired}
        />
      </Card>

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

      <ActivitySection events={activityEvents} loadError={activityLoadError} />

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