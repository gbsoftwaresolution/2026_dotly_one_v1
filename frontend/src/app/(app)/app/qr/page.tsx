import Link from "next/link";
import { redirect } from "next/navigation";

import { QrGeneratorPanel } from "@/components/qr/qr-generator-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function QrPage() {
  const { accessToken } = await requireServerSession(routes.app.qr);

  try {
    const personas = await personaApi.list(accessToken);

    return (
      <section className="space-y-4">
        <PageHeader
          title="My QR"
          description="Generate a standard or quick-connect QR for the persona you want to share right now."
        />

        {personas.length === 0 ? (
          <EmptyState
            title="Create a persona first"
            description="You need at least one persona before you can generate a QR code for sharing."
            action={
              <Link href={routes.app.createPersona}>
                <SecondaryButton className="w-full">
                  Create persona
                </SecondaryButton>
              </Link>
            }
          />
        ) : (
          <QrGeneratorPanel personas={personas} />
        )}
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`${routes.public.login}?next=${routes.app.qr}&reason=expired`);
    }

    return (
      <section className="space-y-4">
        <PageHeader
          title="My QR"
          description="Generate a standard or quick-connect QR for the persona you want to share right now."
        />
        <EmptyState
          title="QR is unavailable"
          description="We could not load your personas right now. Refresh the page and try again in a moment."
        />
      </section>
    );
  }
}
