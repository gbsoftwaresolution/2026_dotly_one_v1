"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/shared/card";
import { personaApi, userApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { PersonaSummary, PublicProfile } from "@/types";
import type { UserProfile } from "@/types/user";

import { PublicProfileCard } from "./public-profile-card";
import { PublicSmartCard } from "./public-smart-card";
import { RequestAccessPanel } from "./request-access-panel";

interface PublicUserInteractionsProps {
  profile: PublicProfile;
  isAuthenticated: boolean;
  loginHref: string;
  showRequestAccessPanel: boolean;
}

export function PublicUserInteractions({
  profile,
  isAuthenticated,
  loginHref,
  showRequestAccessPanel,
}: PublicUserInteractionsProps) {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [resolvedAuth, setResolvedAuth] = useState(isAuthenticated);
  const [personaLoadError, setPersonaLoadError] = useState<string | null>(null);
  const [personasLoading, setPersonasLoading] = useState(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      setResolvedAuth(false);
      setCurrentUser(null);
      setPersonas([]);
      setPersonasLoading(false);
      return;
    }

    let cancelled = false;
    setPersonasLoading(true);
    setPersonaLoadError(null);

    void Promise.allSettled([userApi.getCurrent(), personaApi.list()])
      .then((results) => {
        if (cancelled) {
          return;
        }

        const [userResult, personaResult] = results;

        if (userResult.status === "fulfilled") {
          setResolvedAuth(true);
          setCurrentUser(userResult.value);
        } else {
          setResolvedAuth(false);
          setCurrentUser(null);
          setPersonas([]);
        }

        if (personaResult.status === "fulfilled") {
          setPersonas(personaResult.value);
        } else {
          setPersonas([]);
          setPersonaLoadError(
            personaResult.reason instanceof ApiError
              ? personaResult.reason.message
              : "We could not load your personas right now.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPersonasLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <>
      {profile.sharingMode === "smart_card" ? (
        <PublicSmartCard
          profile={profile}
          initialPersonas={personas}
          isAuthenticated={resolvedAuth}
          loginHref={loginHref}
          personaLoadError={personaLoadError}
          personasLoading={personasLoading}
        />
      ) : (
        <PublicProfileCard profile={profile} />
      )}

      {showRequestAccessPanel ? (
        <div id="request-access-panel" tabIndex={-1}>
          {personasLoading && resolvedAuth ? (
            <Card className="space-y-4">
              <div className="space-y-2">
                <div className="h-3 w-28 animate-pulse rounded-full bg-border/40" />
                <div className="h-7 w-56 animate-pulse rounded-2xl bg-border/50" />
                <div className="h-4 w-full animate-pulse rounded-xl bg-border/35" />
                <div className="h-4 w-5/6 animate-pulse rounded-xl bg-border/35" />
              </div>
              <div className="h-12 animate-pulse rounded-2xl bg-border/35" />
              <div className="h-28 animate-pulse rounded-2xl bg-border/30" />
              <div className="h-[60px] animate-pulse rounded-2xl bg-border/40" />
            </Card>
          ) : (
            <RequestAccessPanel
              profile={profile}
              initialPersonas={personas}
              isAuthenticated={resolvedAuth}
              currentUser={currentUser}
              personaLoadError={personaLoadError}
            />
          )}
        </div>
      ) : null}
    </>
  );
}