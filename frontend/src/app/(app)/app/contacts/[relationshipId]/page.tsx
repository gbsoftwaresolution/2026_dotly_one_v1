import { notFound } from "next/navigation";

import { NoteEditor } from "@/components/contacts/note-editor";
import { RelationshipActions } from "@/components/contacts/relationship-actions";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiError, apiRequest } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import { formatTimeAgo } from "@/lib/utils/format-time-ago";
import type { ContactDetail } from "@/types/contact";

function formatSourceType(sourceType: ContactDetail["sourceType"]): string {
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
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function isNearExpiry(accessEndAt: string): boolean {
  const hoursUntilExpiry =
    (new Date(accessEndAt).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilExpiry <= 24;
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
    memory,
    sourceType,
    createdAt,
    state,
    accessStartAt,
    accessEndAt,
    lastInteractionAt,
    interactionCount,
    isExpired,
  } = contact;

  const nearExpiry =
    !isExpired && accessEndAt ? isNearExpiry(accessEndAt) : false;
  const lastInteractionLabel = formatTimeAgo(lastInteractionAt);

  return (
    <section className="space-y-4">
      <PageHeader
        title={targetPersona.fullName}
        description={`${targetPersona.jobTitle} at ${targetPersona.companyName}`}
      />

      {state === "instant_access" && !isExpired && (
        <div className="rounded-2xl border border-brandRose/50 bg-brandRose/10 px-4 py-3 dark:border-brandCyan/50 dark:bg-brandCyan/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-pulse">
          <p className="font-mono text-xs font-bold text-brandRose dark:text-brandCyan uppercase tracking-widest flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brandRose dark:bg-brandCyan opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brandRose dark:bg-brandCyan"></span>
            </span>
            Temporary Access
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
            Access Revoked
          </p>
        </div>
      )}

      {/* Identity card */}
      <Card className={`space-y-6 ${isExpired ? "opacity-50 grayscale" : ""}`}>
        <div className="flex flex-col items-center text-center gap-4 pt-2">
          {targetPersona.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={targetPersona.profilePhotoUrl}
              alt={targetPersona.fullName}
              className="h-24 w-24 rounded-3xl object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900 text-3xl font-semibold text-white dark:bg-white dark:text-zinc-950 shadow-sm">
              {targetPersona.fullName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-1">
            <h2 className="font-sans text-xl font-bold text-foreground">
              {targetPersona.fullName}
            </h2>
            <p className="font-sans text-sm text-muted">
              @{targetPersona.username}
            </p>
            {targetPersona.tagline ? (
              <p className="font-sans text-sm italic text-muted pt-1">
                &ldquo;{targetPersona.tagline}&rdquo;
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border overflow-hidden rounded-2xl border border-border">
          <div className="bg-surface p-4 space-y-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Relationship State
            </p>
            <div className="pt-0.5">{getStateBadge(state)}</div>
          </div>
          <div className="bg-surface p-4 space-y-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Met Via
            </p>
            <div className="pt-0.5">
              <StatusBadge label={formatSourceType(sourceType)} />
            </div>
          </div>
          <div className="bg-surface p-4 space-y-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Connected Since
            </p>
            <p className="font-mono text-sm text-foreground">
              {formatTimestamp(createdAt)}
            </p>
          </div>
          <div className="bg-surface p-4 space-y-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Last Interaction
            </p>
            <p className="font-sans text-sm text-foreground">
              {lastInteractionLabel}
            </p>
            <p className="font-sans text-xs text-muted">
              Interactions: {interactionCount}
            </p>
          </div>
          {state === "instant_access" && accessEndAt ? (
            <div
              className={`bg-surface p-4 space-y-1 ${
                nearExpiry ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
              }`}
            >
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                Access Ends
              </p>
              <p
                className={`font-mono text-sm ${
                  nearExpiry
                    ? "text-amber-700 dark:text-amber-400 font-semibold"
                    : "text-foreground"
                }`}
              >
                {formatTimestamp(accessEndAt)}
                {nearExpiry ? " (soon)" : ""}
              </p>
            </div>
          ) : null}
          {state === "instant_access" && accessStartAt ? (
            <div className="bg-surface p-4 space-y-1 col-span-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                Access Window
              </p>
              <p className="font-sans text-sm text-foreground">
                Started {formatTimestamp(accessStartAt)}
                {accessEndAt ? ` and ends ${formatTimestamp(accessEndAt)}` : ""}
              </p>
            </div>
          ) : null}
          {memory.sourceLabel ? (
            <div className="bg-surface p-4 space-y-1 col-span-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                Met at
              </p>
              <p className="font-sans text-sm text-foreground">
                {memory.sourceLabel}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Interactive upgrade / expire actions */}
      <RelationshipActions
        relationshipId={relationshipId}
        initialState={state}
        isExpired={isExpired}
        targetPersonaId={targetPersona.id}
        displayName={targetPersona.fullName}
      />

      {/* Note editor */}
      <Card>
        <NoteEditor
          relationshipId={relationshipId}
          initialNote={memory.note}
          disabled={isExpired}
        />
      </Card>
    </section>
  );
}
