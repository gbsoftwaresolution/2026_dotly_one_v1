import Link from "next/link";
import { redirect } from "next/navigation";

import { PersonaList } from "@/components/personas/persona-list";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";

export default async function PersonasPage() {
  const { accessToken } = await requireServerSession("/app/personas");

  try {
    const personas = await personaApi.list(accessToken);

    return (
      <section className="space-y-4">
        <PageHeader
          title="Personas"
          description="Manage the Dotly identities you share in real life."
          action={
            <Link href="/app/personas/create">
              <SecondaryButton>Create persona</SecondaryButton>
            </Link>
          }
        />
        <PersonaList personas={personas} />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?next=/app/personas&reason=expired");
    }

    return (
      <section className="space-y-4">
        <PageHeader
          title="Personas"
          description="Manage the Dotly identities you share in real life."
        />
        <Card>
          <p className="text-sm leading-6 text-muted">
            We could not load your personas right now. Refresh the page and try
            again in a moment.
          </p>
        </Card>
      </section>
    );
  }
}
