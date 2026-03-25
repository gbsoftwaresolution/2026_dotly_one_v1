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
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <PageHeader
        title="Show your QR"
        description="Move from ready identity to live share in one clean control panel."
      />

      <InstantShareExperience
        initialUser={user}
        initialFastShare={initialFastShare}
        initialAnalytics={initialAnalytics}
      />
    </section>
  );
}
