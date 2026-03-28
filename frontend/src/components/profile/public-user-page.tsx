import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { PublicUserInteractions } from "@/components/profile/public-user-interactions";
import { PublicProfileOfflineCard } from "@/components/profile/public-profile-offline-card";
import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { getServerAccessToken } from "@/lib/auth/server-session";
import {
  readSessionCache,
  writeSessionCache,
} from "@/lib/client-session-cache";
import {
  getCanonicalPublicProfilePath,
  getCanonicalPublicSlug,
} from "@/lib/persona/public-profile-path";
import type { PublicProfile } from "@/types/persona";

const PUBLIC_PROFILE_CACHE_PREFIX = "dotly.public-profile";

interface PublicUserPageProps {
  publicIdentifier: string;
  forceCanonicalPath?: boolean;
}

function buildLoginHref(publicUrl: string, publicIdentifier: string): string {
  return `/login?next=${encodeURIComponent(
    getCanonicalPublicProfilePath(publicUrl, publicIdentifier),
  )}`;
}

export async function PublicUserPage({
  publicIdentifier,
  forceCanonicalPath = false,
}: PublicUserPageProps) {
  try {
    const requestHeaders = await headers();
    const profile = await publicApi.getProfile(publicIdentifier, {
      "user-agent": requestHeaders.get("user-agent") ?? "",
      "accept-language": requestHeaders.get("accept-language") ?? "",
      "x-forwarded-for": requestHeaders.get("x-forwarded-for") ?? "",
      "x-idempotency-key": requestHeaders.get("x-idempotency-key") ?? "",
    });
    writeSessionCache(
      `${PUBLIC_PROFILE_CACHE_PREFIX}:${publicIdentifier}`,
      profile,
    );
    const canonicalIdentifier =
      profile.publicIdentifier?.trim().toLowerCase() ||
      getCanonicalPublicSlug(profile.publicUrl, profile.username);

    const canonicalPath = getCanonicalPublicProfilePath(
      profile.publicUrl,
      canonicalIdentifier,
    );
    const requestedIdentifier = publicIdentifier.trim().toLowerCase();

    if (forceCanonicalPath || requestedIdentifier !== canonicalIdentifier) {
      redirect(canonicalPath);
    }

    const accessToken = await getServerAccessToken();
    const isAuthenticated = Boolean(accessToken);

    const isSmartCard = profile.sharingMode === "smart_card";
    const showRequestAccessPanel = profile.sharingMode === "controlled";
    const loginHref = buildLoginHref(profile.publicUrl, canonicalIdentifier);

    return (
      <main
        className={`relative mx-auto flex min-h-screen w-full px-4 sm:px-6 ${
          isSmartCard
            ? "max-w-md items-start py-4 sm:items-center sm:py-8"
            : "max-w-xl items-center py-8"
        }`}
      >
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />
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
      `${PUBLIC_PROFILE_CACHE_PREFIX}:${publicIdentifier}`,
    );

    return (
      <main className="relative mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8 sm:px-6">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />
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
