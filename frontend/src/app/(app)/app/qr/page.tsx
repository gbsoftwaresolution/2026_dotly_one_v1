import Link from "next/link";
import { X } from "lucide-react";

import { InstantShareExperience } from "@/components/share/instant-share-experience";
import { personaApi } from "@/lib/api/persona-api";
import { userApi } from "@/lib/api/user-api";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function QrPage() {
  const { accessToken, user } = await requireServerSession(routes.app.qr);
  const initialFastShare = await personaApi
    .getMyFastShare(accessToken)
    .catch(() => null);
  const initialReferral = await userApi.meReferral(accessToken).catch(() => null);
  const initialAnalytics = await userApi
    .meAnalytics(accessToken)
    .catch(() => null);

  return (
    <section className="relative flex flex-col mx-auto w-full max-w-md gap-6 px-4 animate-fade-up [animation-duration:700ms] pb-safe items-center justify-center min-h-screen-dvh">
      <Link
        href={routes.app.home}
        className="absolute top-6 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-zinc-800/50 dark:hover:bg-zinc-800/80 backdrop-blur-md transition-colors"
      >
        <X className="w-6 h-6 text-foreground" />
      </Link>

      <InstantShareExperience
        initialUser={user}
        initialFastShare={initialFastShare}
        initialReferral={initialReferral}
        initialAnalytics={initialAnalytics}
      />
    </section>
  );
}