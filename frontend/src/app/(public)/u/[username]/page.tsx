import { PublicProfileCard } from "@/components/profile/public-profile-card";
import { RequestAccessPanel } from "@/components/profile/request-access-panel";
import { Card } from "@/components/shared/card";
import { personaApi, publicApi, userApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { getServerAccessToken } from "@/lib/auth/server-session";
import type { PersonaSummary } from "@/types";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function PublicUserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  try {
    const requestHeaders = await headers();
    const profile = await publicApi.getProfile(username, {
      "user-agent": requestHeaders.get("user-agent") ?? "",
      "accept-language": requestHeaders.get("accept-language") ?? "",
      "x-forwarded-for": requestHeaders.get("x-forwarded-for") ?? "",
      "x-idempotency-key": requestHeaders.get("x-idempotency-key") ?? "",
    });
    const accessToken = await getServerAccessToken();

    let isAuthenticated = false;
    let personas: PersonaSummary[] = [];
    let personaLoadError: string | null = null;

    if (accessToken) {
      try {
        await userApi.me(accessToken);
        isAuthenticated = true;

        try {
          personas = await personaApi.list(accessToken);
        } catch (error) {
          personaLoadError =
            error instanceof ApiError
              ? error.message
              : "We could not load your personas right now.";
        }
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          isAuthenticated = false;
        }
      }
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8 sm:px-6">
        <div className="w-full space-y-4">
          <PublicProfileCard profile={profile} />
          <RequestAccessPanel
            profile={profile}
            initialPersonas={personas}
            isAuthenticated={isAuthenticated}
            personaLoadError={personaLoadError}
          />
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
