"use client";

import { useCallback, useEffect, useState } from "react";

import { ContactCard } from "@/components/contacts/contact-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { Contact } from "@/types/contact";
import { useRouter } from "next/navigation";

export function ContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const loadContacts = useCallback(
    async (query?: string) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await contactsApi.list({
          q: query?.trim() || undefined,
        });
        setContacts(result);
      } catch (error) {
        if (isExpiredSessionError(error)) {
          router.replace(
            `/login?next=${encodeURIComponent(routes.app.contacts)}&reason=expired`,
          );
          router.refresh();
          return;
        }

        setLoadError(
          error instanceof ApiError
            ? error.message
            : "We could not load your contacts right now.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContacts(search);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadContacts, search]);

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
          placeholder="Search contacts..."
          className={cn(
            "w-full rounded-2xl border border-border bg-surface px-4 py-3 font-sans text-sm text-foreground placeholder:text-muted/50 transition-all focus:border-brandRose focus:outline-none focus:ring-2 focus:ring-brandRose/20 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20",
          )}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : loadError ? (
        <EmptyState
          title="Contacts unavailable"
          description={loadError}
          action={
            <button
              type="button"
              onClick={() => void loadContacts()}
              className="inline-flex h-[60px] w-full items-center justify-center rounded-2xl bg-brandRose px-5 font-sans text-sm font-bold text-white transition-all hover:bg-brandRose/90 active:scale-95 dark:bg-brandCyan dark:text-zinc-950 dark:hover:bg-brandCyan/90 focus:outline-none focus:ring-2 focus:ring-brandRose focus:ring-offset-2"
            >
              Try again
            </button>
          }
        />
      ) : contacts.length === 0 ? (
        <EmptyState
          title={search.trim() ? "No results" : "No contacts yet"}
          description={
            search.trim()
              ? `No contacts match "${search}".`
              : "Approved and active temporary relationships will appear here once a permissioned connection is established."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((contact) => (
            <ContactCard key={contact.relationshipId} contact={contact} />
          ))}
        </div>
      )}
    </section>
  );
}
