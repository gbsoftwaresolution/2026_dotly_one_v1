import Link from "next/link";
import { notFound } from "next/navigation";

import { PersonaEditForm } from "@/components/personas/persona-edit-form";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiError, apiRequest } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import { formatAccessMode } from "@/lib/persona/labels";
import type { PersonaSummary } from "@/types/persona";

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  const { accessToken } = await requireServerSession(`/app-old/personas/${personaId}`);

  let persona: PersonaSummary | null = null;
  let loadError: string | null = null;

  try {
    persona = await apiRequest<PersonaSummary>(`/personas/${personaId}`, {
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
        : "We could not load this persona right now.";
  }

  if (loadError) {
    return (
      <section className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Persona unavailable"
          description="This persona cannot be loaded right now."
        />
        <div className="space-y-2 rounded-[2rem] bg-rose-500/5 px-5 py-5 ring-1 ring-inset ring-rose-500/20 sm:rounded-3xl sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-rose-700 dark:text-rose-300">
            Unable to load persona
          </h2>
          <p className="text-sm leading-6 text-rose-700 dark:text-rose-300">
            {loadError}
          </p>
        </div>
      </section>
    );
  }

  if (!persona) {
    notFound();
  }

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title={persona.fullName}
        description={[
          persona.jobTitle,
          persona.companyName,
          `@${persona.username}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Link href={routes.app.personaSettings(persona.id)}>
            <SecondaryButton className="w-full min-h-11 px-4 py-2 text-sm sm:w-auto">
              Sharing Mode
            </SecondaryButton>
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="space-y-5 sm:space-y-6">
          <section className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Step 1
              </p>
              <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Live profile status
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge label={formatAccessMode(persona.accessMode)} />
              {persona.verifiedOnly ? (
                <StatusBadge label="Verified only" />
              ) : null}
              {persona.isVerified ? (
                <StatusBadge label="Verified badge on" />
              ) : null}
            </div>

            {persona.tagline || persona.websiteUrl ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {persona.tagline ? (
                  <div className="rounded-2xl bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/[0.06] sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Tagline
                    </p>
                    <p className="mt-2 text-sm leading-7 text-foreground/88">
                      {persona.tagline}
                    </p>
                  </div>
                ) : null}
                {persona.websiteUrl ? (
                  <div className="rounded-2xl bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/5 dark:bg-zinc-950 dark:ring-white/[0.06] sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Website
                    </p>
                    <a
                      href={persona.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:opacity-70"
                    >
                      {persona.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Step 2
              </p>
              <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Refine this persona
              </h2>
              <p className="text-sm leading-6 text-muted">
                Changes take effect immediately on your public profile.
              </p>
            </div>

            <PersonaEditForm persona={persona} />
          </section>
        </div>
      </div>
    </section>
  );
}
