import { notFound } from "next/navigation";

import { BlockUserButton } from "@/components/contacts/block-user-button";
import { NoteEditor } from "@/components/contacts/note-editor";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiError, apiRequest } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import type { ContactDetail } from "@/types/contact";

function formatSourceType(sourceType: ContactDetail["sourceType"]): string {
  return sourceType === "qr" ? "QR" : "Profile";
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

  const { targetPersona, targetUserId, memory, sourceType, createdAt } =
    contact;

  return (
    <section className="space-y-4">
      <PageHeader
        title={targetPersona.fullName}
        description={`${targetPersona.jobTitle} at ${targetPersona.companyName}`}
      />

      {/* Identity card */}
      <Card className="space-y-6">
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
              Connected Since
            </p>
            <p className="font-mono text-sm text-foreground">
              {formatTimestamp(createdAt)}
            </p>
          </div>
          <div className="bg-surface p-4 space-y-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
              Met Via
            </p>
            <div className="pt-0.5">
              <StatusBadge label={formatSourceType(sourceType)} />
            </div>
          </div>
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

      {/* Note editor */}
      <Card>
        <NoteEditor relationshipId={relationshipId} initialNote={memory.note} />
      </Card>

      {/* Danger zone */}
      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
            Actions
          </p>
          <p className="font-sans text-sm text-muted">
            Blocking removes this contact and prevents future requests.
          </p>
        </div>
        <BlockUserButton
          userId={targetUserId}
          displayName={targetPersona.fullName}
        />
      </Card>
    </section>
  );
}
