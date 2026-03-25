import { InstantShareExperience } from "@/components/share/instant-share-experience";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { userApi } from "@/lib/api/user-api";
import { routes } from "@/lib/constants/routes";
import { personaApi } from "@/lib/api/persona-api";

export default async function QrPage() {
  const { accessToken, user } = await requireServerSession(routes.app.qr);
  const initialFastShare = await personaApi
    .getMyFastShare(accessToken)
    .catch(() => null);
  const initialAnalytics = await userApi
    .meAnalytics(accessToken)
    .catch(() => null);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-2 py-2 sm:gap-6 sm:px-4 sm:py-4">
      <PageHeader
        title="Show your QR"
        description="Move from ready identity to live share in one clean control panel."
      />

      <div className="space-y-4 rounded-[2rem] bg-foreground/[0.02] px-4 py-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:px-5 sm:py-5">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Share system
          </p>
          <p className="text-sm leading-6 text-muted">
            Pick the right persona, keep your QR ready, and hand off the
            clearest next step in seconds.
          </p>
        </div>

        <InstantShareExperience
          initialUser={user}
          initialFastShare={initialFastShare}
          initialAnalytics={initialAnalytics}
        />
      </div>
    </section>
  );
}
