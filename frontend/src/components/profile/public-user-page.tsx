import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PublicProfileCard } from "@/components/profile/public-profile-card";
import { PublicSmartCard } from "@/components/profile/public-smart-card";
import { RequestAccessPanel } from "@/components/profile/request-access-panel";
import { personaApi, publicApi, userApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { getServerAccessToken } from "@/lib/auth/server-session";
import {
  hasPublicSmartCardDirectActions,
  resolvePublicSmartCardPrimaryCta,
} from "@/lib/persona/smart-card";
import type { PersonaSummary } from "@/types";

interface PublicUserPageProps {
  username: string;
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

    let isAuthenticated = false;
    let currentUser = null;
    let personas: PersonaSummary[] = [];
    let personaLoadError: string | null = null;

    if (accessToken) {
      try {
        currentUser = await userApi.me(accessToken);
        isAuthenticated = true;

        try {
          personas = await personaApi.list(accessToken);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            isAuthenticated = false;
            personas = [];
          }

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

    const isSmartCard = profile.sharingMode === "smart_card";
    const resolvedSmartCardPrimaryCta =
      profile.sharingMode === "smart_card" && profile.smartCard
        ? resolvePublicSmartCardPrimaryCta(profile.smartCard.primaryAction, {
            instantConnectUrl: profile.instantConnectUrl,
            actionState: profile.smartCard.actionState,
            hasDirectActions: hasPublicSmartCardDirectActions(profile),
          })
        : null;
    const showRequestAccessPanel =
      profile.sharingMode === "controlled" ||
      (resolvedSmartCardPrimaryCta?.action === "request_access" &&
        !resolvedSmartCardPrimaryCta.isDisabled);

    return (
      <main
        className={`mx-auto flex min-h-screen w-full items-center px-4 py-8 sm:px-6 ${
          isSmartCard ? "max-w-md" : "max-w-xl"
        }`}
      >
        <div className="w-full space-y-4">
          {isSmartCard ? (
            <PublicSmartCard profile={profile} />
          ) : (
            <PublicProfileCard profile={profile} />
          )}

          {showRequestAccessPanel ? (
            <div id="request-access-panel">
              <RequestAccessPanel
                profile={profile}
                initialPersonas={personas}
                isAuthenticated={isAuthenticated}
                currentUser={currentUser}
                personaLoadError={personaLoadError}
              />
            </div>
          ) : null}
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
            Profile unavailable
          </h1>
          <p className="text-sm leading-6 text-rose-500/90 dark:text-rose-400/80">
            {message}
          </p>
        </div>
      </main>
    );
  }
}
