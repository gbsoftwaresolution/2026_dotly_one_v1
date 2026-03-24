"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ContactCard } from "@/components/contacts/contact-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { contactsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { refreshContacts, useAppDataSnapshot } from "@/lib/app-data-store";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";
import { isExpiredSessionError } from "@/lib/utils/auth-errors";
import { cn } from "@/lib/utils/cn";
import type { Contact } from "@/types/contact";
import { useRouter } from "next/navigation";

type ContactPriorityTone = "attention" | "recent" | "planned";
type ContactSectionKind = "attention" | "planned" | "recent" | "all";

interface ContactPriority {
  bucket: ContactSectionKind;
  label: string;
  tone: ContactPriorityTone;
}

interface ContactSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

function ContactSection({
  title,
  description,
  children,
}: ContactSectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1 px-1">
        <h2 className="font-sans text-base font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function getContactPriority(
  contact: Contact,
): ContactPriority | null {
  if (contact.followUpSummary.isOverdue) {
    return { bucket: "attention", label: "Overdue", tone: "attention" };
  }

  if (contact.followUpSummary.isUpcomingSoon) {
    return { bucket: "attention", label: "Due soon", tone: "attention" };
  }

  if (contact.followUpSummary.hasPassiveInactivityFollowUp) {
    return { bucket: "attention", label: "Reconnect", tone: "attention" };
  }

  if (contact.followUpSummary.hasPendingFollowUp) {
    return { bucket: "planned", label: "Planned", tone: "planned" };
  }

  if (contact.metadata.isRecentlyActive) {
    return { bucket: "recent", label: "Recent", tone: "recent" };
  }

  return null;
}

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
      contact.memory.note,
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
  const sectionedContacts = useMemo(() => {
    const priorities = new Map<string, ContactPriority>();
    const needsAttention: Contact[] = [];
    const plannedFollowUps: Contact[] = [];
    const recentConnections: Contact[] = [];
    const allContacts: Contact[] = [];

    displayedContacts.forEach((contact) => {
      const priority = getContactPriority(contact);

      if (priority) {
        priorities.set(contact.relationshipId, priority);
      }

      if (priority?.bucket === "attention") {
        needsAttention.push(contact);
        return;
      }

      if (priority?.bucket === "planned") {
        plannedFollowUps.push(contact);
        return;
      }

      if (priority?.bucket === "recent") {
        recentConnections.push(contact);
        return;
      }

      allContacts.push(contact);
    });

    return {
      priorities,
      needsAttention,
      plannedFollowUps,
      recentConnections,
      allContacts,
    };
  }, [displayedContacts]);
  const hasCachedContacts = contactsState.data.length > 0 || contactsState.status === "ready";
  const showSkeleton =
    displayedContacts.length === 0 &&
    (trimmedSearch
      ? isSearchRefreshing && !hasCachedContacts
      : (contactsState.status === "idle" || contactsState.status === "loading") && !hasCachedContacts);
  const loadError = trimmedSearch ? searchError : contactsState.error;
  const isRefreshing = trimmedSearch ? isSearchRefreshing : contactsState.status === "loading";

  const renderContactCard = (contact: Contact) => {
    const priority = sectionedContacts.priorities.get(contact.relationshipId);

    return (
      <ContactCard
        key={contact.relationshipId}
        contact={contact}
        hasPassiveReminder={contact.followUpSummary.hasPassiveInactivityFollowUp}
        priorityLabel={priority?.label}
        priorityTone={priority?.tone}
      />
    );
  };

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
      ) : trimmedSearch ? (
        <div className="flex flex-col gap-3">
          {displayedContacts.map((contact) => renderContactCard(contact))}
        </div>
      ) : (
        <div className="space-y-6">
          {sectionedContacts.needsAttention.length > 0 ? (
            <ContactSection
              title="Needs attention"
              description="Overdue follow-ups, due-soon reminders, and quieter relationships worth picking back up."
            >
              {sectionedContacts.needsAttention.map((contact) =>
                renderContactCard(contact),
              )}
            </ContactSection>
          ) : (
            <div className="rounded-3xl border border-border/70 bg-surface/70 px-5 py-4">
              <p className="font-sans text-sm font-semibold text-foreground">
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                No one needs a nudge right now.
              </p>
            </div>
          )}

          {sectionedContacts.plannedFollowUps.length > 0 ? (
            <ContactSection
              title="Coming up"
              description="People you already planned to reach back out to."
            >
              {sectionedContacts.plannedFollowUps.map((contact) =>
                renderContactCard(contact),
              )}
            </ContactSection>
          ) : null}

          {sectionedContacts.recentConnections.length > 0 ? (
            <ContactSection
              title="Recent connections"
              description="People you&apos;ve been in touch with lately."
            >
              {sectionedContacts.recentConnections.map((contact) =>
                renderContactCard(contact),
              )}
            </ContactSection>
          ) : null}

          {sectionedContacts.allContacts.length > 0 ? (
            <ContactSection title="All contacts">
              {sectionedContacts.allContacts.map((contact) =>
                renderContactCard(contact),
              )}
            </ContactSection>
          ) : null}
        </div>
      )}
    </section>
  );
}
