import Link from "next/link";
import { redirect } from "next/navigation";

import { QrGeneratorPanel } from "@/components/qr/qr-generator-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { personaApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function QrPage() {
  const { accessToken, user } = await requireServerSession(routes.app.qr);

  try {
    const personas = await personaApi.list(accessToken);

    return (
      <section className="mx-auto flex w-full max-w-xl flex-col items-center justify-center space-y-8 py-12">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            QR Sharing
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Select a persona to generate a standard or quick-connect QR.
          </p>
        </div>

        {personas.length === 0 ? (
          <EmptyState
            title="Create a persona first"
            description="You need at least one persona before you can generate a QR code for sharing."
            action={
              <Link href={routes.app.createPersona}>
                <SecondaryButton className="w-full py-5 h-[60px] active:scale-95">
                  Create persona
                </SecondaryButton>
              </Link>
            }
          />
        ) : (
          <div className="w-full">
            <QrGeneratorPanel
              personas={personas}
              isVerified={user.isVerified}
              currentUserEmail={user.email}
            />
          </div>
        )}
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`${routes.public.login}?next=${routes.app.qr}&reason=expired`);
    }

    return (
      <section className="mx-auto flex w-full max-w-xl flex-col items-center justify-center space-y-8 py-12">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            QR Sharing
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Select a persona to generate a standard or quick-connect QR.
          </p>
        </div>
        <EmptyState
          title="QR is unavailable"
          description="We could not load your personas right now. Refresh the page and try again in a moment."
        />
      </section>
    );
  }
}
