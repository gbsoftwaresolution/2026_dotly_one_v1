import { notFound } from "next/navigation";

import { PersonaEditForm } from "@/components/personas/persona-edit-form";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
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
  const { accessToken } = await requireServerSession(
    routes.app.personaDetail(personaId),
  );

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
      <section className="space-y-4">
        <PageHeader
          title="Persona unavailable"
          description="This persona cannot be loaded right now."
        />
        <Card className="space-y-2 border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30">
          <h2 className="font-sans text-lg font-semibold text-rose-700 dark:text-rose-300">
            Unable to load persona
          </h2>
          <p className="font-sans text-sm leading-6 text-rose-700 dark:text-rose-300">
            {loadError}
          </p>
        </Card>
      </section>
    );
  }

  if (!persona) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title={persona.fullName}
        description={`@${persona.username} · ${persona.jobTitle} at ${persona.companyName}`}
      />

      {/* Status row */}
      <Card className="flex items-center gap-3">
        <StatusBadge label={formatAccessMode(persona.accessMode)} />
        {persona.verifiedOnly ? <StatusBadge label="Verified only" /> : null}
      </Card>

      {/* Edit form */}
      <Card className="space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
            Edit persona
          </p>
          <p className="font-sans text-sm text-muted">
            Changes take effect immediately on your public profile.
          </p>
        </div>
        <PersonaEditForm persona={persona} />
      </Card>
    </section>
  );
}
