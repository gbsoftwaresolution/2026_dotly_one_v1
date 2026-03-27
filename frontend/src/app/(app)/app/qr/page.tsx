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
  const initialReferral = await userApi
    .meReferral(accessToken)
    .catch(() => null);
  const initialAnalytics = await userApi
    .meAnalytics(accessToken)
    .catch(() => null);

  return (
    <section className="relative w-full flex flex-col items-center">
      {/* Immersive Background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[50vh] w-[50vw] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50vh] w-[50vw] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] pt-2 pb-16 sm:pb-24 animate-fade-up [animation-duration:500ms] ease-out">
        <div className="flex items-center justify-end mb-6">
          <Link
            href={routes.app.home}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md transition-colors active:scale-95 shadow-sm"
          >
            <X className="w-5 h-5 text-foreground" />
          </Link>
        </div>

        <div className="w-full">
          <InstantShareExperience
            initialUser={user}
            initialFastShare={initialFastShare}
            initialReferral={initialReferral}
            initialAnalytics={initialAnalytics}
          />
        </div>
      </div>
    </section>
  );
}
