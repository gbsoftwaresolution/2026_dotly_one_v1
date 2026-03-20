import { PublicProfileCard } from "@/components/profile/public-profile-card";
import { RequestAccessPanel } from "@/components/profile/request-access-panel";
import { Card } from "@/components/shared/card";
import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { notFound } from "next/navigation";

export default async function PublicUserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  try {
    const profile = await publicApi.getProfile(username);

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8 sm:px-6">
        <div className="w-full space-y-4">
          <PublicProfileCard profile={profile} />
          <RequestAccessPanel profile={profile} />
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    const message =
      error instanceof ApiError
        ? error.message
        : "We could not load this public profile right now.";

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8 sm:px-6">
        <Card className="w-full space-y-2 border-rose-200 bg-rose-50/80 text-center">
          <h1 className="text-xl font-semibold text-rose-700">
            Profile unavailable
          </h1>
          <p className="text-sm leading-6 text-rose-700">{message}</p>
        </Card>
      </main>
    );
  }
}
