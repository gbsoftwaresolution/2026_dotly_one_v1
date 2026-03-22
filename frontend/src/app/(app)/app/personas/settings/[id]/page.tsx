import { notFound } from "next/navigation";

import { PersonaSharingSettingsForm } from "@/components/personas/persona-sharing-settings-form";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ApiError, apiRequest } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import type { PersonaSummary } from "@/types/persona";

export default async function PersonaSharingSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { accessToken } = await requireServerSession(routes.app.personaSettings(id));

  let persona: PersonaSummary | null = null;
  let loadError: string | null = null;

  try {
    persona = await apiRequest<PersonaSummary>(`/personas/${id}`, {
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
        : "We could not load sharing settings right now.";
  }

  if (loadError) {
    return (
      <section className="space-y-4">
        <PageHeader
          title="Sharing settings unavailable"
          description="This persona cannot be loaded right now."
        />
        <Card className="space-y-2 border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30">
          <h2 className="font-sans text-lg font-semibold text-rose-700 dark:text-rose-300">
            Unable to load sharing settings
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
    <section className="space-y-4 pb-24">
      <PageHeader
        title="How people can access you"
        description={`Set how ${persona.fullName} handles new interactions and what Smart Card actions are available.`}
      />

      <Card className="overflow-visible">
        <PersonaSharingSettingsForm persona={persona} />
      </Card>
    </section>
  );
}