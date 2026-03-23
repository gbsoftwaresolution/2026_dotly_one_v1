import { InstantShareExperience } from "@/components/share/instant-share-experience";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function QrPage() {
  const { user } = await requireServerSession(routes.app.qr);

  return (
    <section className="mx-auto flex min-h-screen-dvh w-full max-w-2xl flex-col justify-center px-4 py-4 sm:px-6 sm:py-6">
      <InstantShareExperience initialUser={user} />
    </section>
  );
}
