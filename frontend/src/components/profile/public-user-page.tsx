import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PublicUserInteractions } from "@/components/profile/public-user-interactions";
import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { getServerAccessToken } from "@/lib/auth/server-session";
import {
  hasPublicSmartCardDirectActions,
  resolvePublicSmartCardPrimaryCta,
} from "@/lib/persona/smart-card";

interface PublicUserPageProps {
  username: string;
}

function buildLoginHref(username: string): string {
  return `/login?next=${encodeURIComponent(`/u/${username}`)}`;
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
    const accessToken = await getServerAccessToken();
    const isAuthenticated = Boolean(accessToken);

    const isSmartCard = profile.sharingMode === "smart_card";
    const resolvedSmartCardPrimaryCta =
      profile.sharingMode === "smart_card" && profile.smartCard
        ? resolvePublicSmartCardPrimaryCta(profile.smartCard.primaryAction, {
            instantConnectUrl: profile.instantConnectUrl,
            actionState: profile.smartCard.actionState,
            hasDirectActions: hasPublicSmartCardDirectActions(profile),
          })
        : null;
    const supportsInstantConnectRequestFallback =
      profile.sharingMode === "smart_card" &&
      profile.smartCard !== null &&
      resolvedSmartCardPrimaryCta?.requestedAction === "instant_connect" &&
      profile.smartCard.actionState.requestAccessEnabled;
    const showRequestAccessPanel =
      profile.sharingMode === "controlled" ||
      (resolvedSmartCardPrimaryCta?.action === "request_access" &&
        !resolvedSmartCardPrimaryCta.isDisabled) ||
      supportsInstantConnectRequestFallback;
    const loginHref = buildLoginHref(profile.username);

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

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8 sm:px-6">
        <div className="w-full rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-2">
          <h1 className="text-xl font-semibold text-rose-500 dark:text-rose-400">
            Profile not available
          </h1>
        </div>
      </main>
    );
  }
}
