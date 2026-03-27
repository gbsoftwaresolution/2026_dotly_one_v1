import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PublicUserInteractions } from "@/components/profile/public-user-interactions";
import { PublicProfileOfflineCard } from "@/components/profile/public-profile-offline-card";
import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { getServerAccessToken } from "@/lib/auth/server-session";
import {
  readSessionCache,
  writeSessionCache,
} from "@/lib/client-session-cache";
import { getCanonicalPublicProfilePath } from "@/lib/persona/public-profile-path";
import type { PublicProfile } from "@/types/persona";

const PUBLIC_PROFILE_CACHE_PREFIX = "dotly.public-profile";

interface PublicUserPageProps {
  username: string;
}

function buildLoginHref(publicUrl: string, username: string): string {
  return `/login?next=${encodeURIComponent(
    getCanonicalPublicProfilePath(publicUrl, username),
  )}`;
}

export async function PublicUserPage({ username }: PublicUserPageProps) {
  try {
    const requestHeaders = await headers();
    const profile = await publicApi.getProfile(username, {
      "user-agent": requestHeaders.get("user-agent") ?? "",
      "accept-language": requestHeaders.get("accept-language") ?? "",
      "x-forwarded-for": requestHeaders.get("x-forwarded-for") ?? "",
      "x-idempotency-key": requestHeaders.get("x-idempotency-key") ?? "",
    });
    writeSessionCache(`${PUBLIC_PROFILE_CACHE_PREFIX}:${username}`, profile);
    const accessToken = await getServerAccessToken();
    const isAuthenticated = Boolean(accessToken);

    const isSmartCard = profile.sharingMode === "smart_card";
    const showRequestAccessPanel = profile.sharingMode === "controlled";
    const loginHref = buildLoginHref(profile.publicUrl, profile.username);

    return (
      <main
        className={`mx-auto flex min-h-screen w-full px-4 sm:px-6 ${
          isSmartCard
            ? "max-w-md items-start py-4 sm:items-center sm:py-8"
            : "max-w-xl items-center py-8"
        }`}
      >
        <div className="w-full space-y-4">
          <PublicUserInteractions
            profile={profile}
            isAuthenticated={isAuthenticated}
            loginHref={loginHref}
            showRequestAccessPanel={showRequestAccessPanel}
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

    const cachedProfile = readSessionCache<PublicProfile>(
      `${PUBLIC_PROFILE_CACHE_PREFIX}:${username}`,
    );

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8 sm:px-6">
        {cachedProfile ? (
          <PublicProfileOfflineCard profile={cachedProfile} />
        ) : (
          <div className="w-full rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-2">
            <h1 className="text-xl font-semibold text-rose-500 dark:text-rose-400">
              Profile not available
            </h1>
            <p className="text-sm leading-6 text-rose-500/90 dark:text-rose-400/80">
              {message}
            </p>
          </div>
        )}
      </main>
    );
  }
}
