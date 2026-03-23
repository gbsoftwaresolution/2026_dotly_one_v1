"use client";

import { useEffect, useMemo, useState } from "react";

import { ContactCard } from "@/components/contacts/contact-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import {
  refreshContacts,
  useAppDataSnapshot,
} from "@/lib/app-data-store";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { Contact } from "@/types/contact";
import { useRouter } from "next/navigation";

function filterContacts(contacts: Contact[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return contacts;
  }

  return contacts.filter((contact) => {
    const haystack = [
      contact.targetPersona.fullName,
      contact.targetPersona.username,
      contact.targetPersona.jobTitle,
      contact.targetPersona.companyName,
      contact.contextLabel,
      contact.memory.sourceLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function ContactsScreen() {
  const router = useRouter();
  const { contacts: contactsState } = useAppDataSnapshot();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchRefreshing, setIsSearchRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const trimmedSearch = search.trim();
  const cachedMatches = useMemo(
    () => filterContacts(contactsState.data, trimmedSearch),
    [contactsState.data, trimmedSearch],
  );
  const displayedContacts = trimmedSearch
    ? (searchResults ?? cachedMatches)
    : contactsState.data;
  const hasCachedContacts = contactsState.data.length > 0 || contactsState.status === "ready";
  const showSkeleton =
    displayedContacts.length === 0 &&
    (trimmedSearch
      ? isSearchRefreshing && !hasCachedContacts
      : (contactsState.status === "idle" || contactsState.status === "loading") && !hasCachedContacts);
  const loadError = trimmedSearch ? searchError : contactsState.error;
  const isRefreshing = trimmedSearch ? isSearchRefreshing : contactsState.status === "loading";

  useEffect(() => {
    // Check if redirected from a block action
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("message") === "node-removed") {
        setSuccessMessage("Contact blocked and removed");
        window.history.replaceState({}, "", url.pathname);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    }
  }, []);

  useEffect(() => {
    void refreshContacts().catch((error) => {
      if (isExpiredSessionError(error)) {
        router.replace(
          `/login?next=${encodeURIComponent(routes.app.contacts)}&reason=expired`,
        );
      }
    });
  }, [router]);

  useEffect(() => {
    if (!trimmedSearch) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSearchRefreshing(true);
      setSearchError(null);

      void contactsApi
        .list({ q: trimmedSearch })
        .then((result) => {
          setSearchResults(result);
        })
        .catch((error) => {
          if (isExpiredSessionError(error)) {
            router.replace(
              `/login?next=${encodeURIComponent(routes.app.contacts)}&reason=expired`,
            );
            return;
          }

          setSearchError(
            error instanceof ApiError
              ? error.message
              : "We could not load your contacts right now.",
          );
        })
        .finally(() => {
          setIsSearchRefreshing(false);
        });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [router, trimmedSearch]);

  return (
    <section className="space-y-4">
      {successMessage && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {successMessage}
          </p>
        </div>
      )}

      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connections..."
          className={cn(
            "w-full rounded-2xl border border-border bg-surface px-4 py-3 font-sans text-sm text-foreground placeholder:text-muted/50 transition-all focus:border-brandRose focus:outline-none focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20",
          )}
        />
      </div>

      <div className="min-h-5 px-1">
        {isRefreshing ? (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
            Updating connections...
          </p>
        ) : null}
      </div>

      {showSkeleton ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : loadError ? (
        <EmptyState
          title="Connections unavailable"
          description={loadError}
          action={
            <button
              type="button"
              onClick={() => {
                if (trimmedSearch) {
                  setSearchResults(null);
                  setSearchError(null);
                  setSearch((current) => current.trim());
                  return;
                }

                void refreshContacts({ force: true }).catch((error) => {
                  if (isExpiredSessionError(error)) {
                    router.replace(
                      `/login?next=${encodeURIComponent(routes.app.contacts)}&reason=expired`,
                    );
                  }
                });
              }}
              className="inline-flex h-[60px] w-full items-center justify-center rounded-2xl bg-brandRose px-5 font-sans text-sm font-bold text-white transition-all hover:bg-brandRose/90 active:scale-95 dark:bg-brandCyan dark:text-zinc-950 dark:hover:bg-brandCyan/90 focus:outline-none focus:ring-2 focus:ring-brandRose focus:ring-offset-2"
            >
              Try again
            </button>
          }
        />
      ) : displayedContacts.length === 0 ? (
        <EmptyState
          title={search.trim() ? "No results" : "No connections yet"}
          description={
            search.trim()
              ? `No connections match "${search}".`
              : dotlyPositioning.app.noContacts
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {displayedContacts.map((contact) => (
            <ContactCard key={contact.relationshipId} contact={contact} />
          ))}
        </div>
      )}
    </section>
  );
}
