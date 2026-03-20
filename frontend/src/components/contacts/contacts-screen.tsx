"use client";

import { useEffect, useState } from "react";

import { ContactCard } from "@/components/contacts/contact-card";
import { EmptyState } from "@/components/shared/empty-state";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type { Contact } from "@/types/contact";

export function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadContacts(query?: string) {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await contactsApi.list({ q: query?.trim() || undefined });
      setContacts(result);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "We could not load your contacts right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContacts(search);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return (
    <section className="space-y-4">
      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className={cn(
            "w-full rounded-2xl border border-border bg-white px-4 py-3 font-sans text-sm text-foreground placeholder:text-muted/60 transition-all focus:border-brandRose focus:outline-none focus:ring-2 focus:ring-brandRose/20 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-brandCyan dark:focus:ring-brandCyan/20",
          )}
        />
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-border bg-surface/70 px-5 py-6 text-center font-sans text-sm text-muted">
          Loading your contacts...
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
          title={search.trim() ? "No results" : "No Nodes in Ledger"}
          description={
            search.trim()
              ? `No contacts match "${search}".`
              : "Connections will appear here once your permissioned handshakes are approved in the request cycle."
          }
        />
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <ContactCard key={contact.relationshipId} contact={contact} />
          ))}
        </div>
      )}
    </section>
  );
}
