import { notFound } from "next/navigation";

import { PersonaSharingSettingsForm } from "@/components/personas/persona-sharing-settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { ApiError, apiRequest } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import type { PersonaSummary } from "@/types/persona";

export default async function PersonaSharingSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { accessToken } = await requireServerSession(`/app-old/personas/settings/${id}`);

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
      <section className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Sharing settings unavailable"
          description="This persona cannot be loaded right now."
        />
        <div className="space-y-2 rounded-[2rem] bg-rose-500/5 px-5 py-5 ring-1 ring-inset ring-rose-500/20 sm:rounded-3xl sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-rose-700 dark:text-rose-300">
            Unable to load sharing settings
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
    <section className="space-y-5 pb-24 sm:space-y-6">
      <PageHeader
        title="How people can access you"
        description={`Decide how ${persona.fullName} is introduced first, and what people can do from the public card.`}
      />

      <div className="flex flex-col gap-4">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Sharing system
          </p>
          <p className="text-sm leading-6 text-muted">
            Tune the first impression, contact actions, and Smart Card behavior
            for this persona.
          </p>
        </div>
        <PersonaSharingSettingsForm persona={persona} />
      </div>
    </section>
  );
}
