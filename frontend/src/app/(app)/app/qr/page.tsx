import { InstantShareExperience } from "@/components/share/instant-share-experience";
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
    <section className="mx-auto flex min-h-screen-dvh w-full max-w-none flex-col justify-center px-2 py-2 sm:px-4 sm:py-4">
      <InstantShareExperience
        initialUser={user}
        initialFastShare={initialFastShare}
        initialAnalytics={initialAnalytics}
      />
    </section>
  );
}
