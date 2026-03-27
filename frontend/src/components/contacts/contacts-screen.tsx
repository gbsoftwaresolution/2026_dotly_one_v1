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

function ContactSection({ title, description, children }: ContactSectionProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col overflow-hidden rounded-[1.25rem] bg-foreground/[0.02] backdrop-blur-[40px] saturate-[200%] ring-[0.5px] ring-black/5 dark:bg-white/[0.03] dark:ring-white/10 shadow-sm divide-y divide-black/5 dark:divide-white/5">
        {children}
      </div>
    </section>
  );
}

function getContactPriority(contact: Contact): ContactPriority | null {
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
  const hasCachedContacts =
    contactsState.data.length > 0 || contactsState.status === "ready";
  const showSkeleton =
    displayedContacts.length === 0 &&
    (trimmedSearch
      ? isSearchRefreshing && !hasCachedContacts
      : (contactsState.status === "idle" ||
          contactsState.status === "loading") &&
        !hasCachedContacts);
  const loadError = trimmedSearch ? searchError : contactsState.error;
  const isRefreshing = trimmedSearch
    ? isSearchRefreshing
    : contactsState.status === "loading";

  const renderContactCard = (contact: Contact) => {
    const priority = sectionedContacts.priorities.get(contact.relationshipId);

    return (
      <ContactCard
        key={contact.relationshipId}
        contact={contact}
        hasPassiveReminder={
          contact.followUpSummary.hasPassiveInactivityFollowUp
        }
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
        <div className="rounded-2xl bg-emerald-500/5 px-4 py-3 ring-1 ring-inset ring-emerald-500/20">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {successMessage}
          </p>
        </div>
      )}

      <div className="rounded-[1.25rem] bg-foreground/[0.02] backdrop-blur-[40px] saturate-[200%] ring-[0.5px] ring-black/5 dark:bg-white/[0.03] dark:ring-white/10 shadow-sm p-4 sm:p-5">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Relationship view
            </p>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Keep your network close
            </h2>
          </div>

          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trusted contacts..."
              className={cn(
                "w-full rounded-2xl bg-foreground/[0.03] px-4 py-3.5 font-sans text-sm text-foreground placeholder:text-muted/50 shadow-inner ring-1 ring-inset ring-black/5 transition-all focus:bg-foreground/[0.05] focus:outline-none focus:ring-black/10 dark:bg-white/[0.045] dark:ring-white/5 dark:focus:bg-white/[0.06]",
              )}
            />
          </div>

          <div className="min-h-5 px-1">
            {isRefreshing ? (
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                Refreshing your network...
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-3 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : loadError ? (
        <EmptyState
          title="Relationships unavailable"
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
              className="inline-flex h-[60px] w-full items-center justify-center rounded-2xl bg-foreground px-5 font-sans text-sm font-bold text-background transition-all duration-200 hover:scale-[0.995] hover:opacity-95 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-foreground/15 focus:ring-offset-2"
            >
              Try again
            </button>
          }
        />
      ) : displayedContacts.length === 0 ? (
        <EmptyState
          title={
            search.trim()
              ? "No one matches this search"
              : "No trusted relationships yet"
          }
          description={
            search.trim()
              ? `No trusted contacts match "${search}".`
              : dotlyPositioning.app.noContacts
          }
        />
      ) : trimmedSearch ? (
        <div className="flex flex-col overflow-hidden rounded-[1.25rem] bg-foreground/[0.02] backdrop-blur-[40px] saturate-[200%] ring-[0.5px] ring-black/5 dark:bg-white/[0.03] dark:ring-white/10 shadow-sm divide-y divide-black/5 dark:divide-white/5">
          {displayedContacts.map((contact) => renderContactCard(contact))}
        </div>
      ) : (
        <div className="space-y-6">
          {sectionedContacts.needsAttention.length > 0 ? (
            <ContactSection
              title="Warm follow-through"
              description="People who deserve a reply, a thoughtful nudge, or a renewed conversation before the relationship cools down."
            >
              {sectionedContacts.needsAttention.map((contact) =>
                renderContactCard(contact),
              )}
            </ContactSection>
          ) : (
            <div className="rounded-[1.75rem] bg-foreground/[0.02] px-5 py-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl">
              <p className="font-sans text-sm font-semibold text-foreground">
                Your follow-through is in good shape
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                No one needs a nudge right now. The network can breathe.
              </p>
            </div>
          )}

          {sectionedContacts.plannedFollowUps.length > 0 ? (
            <ContactSection
              title="Planned touchpoints"
              description="People you already decided to keep warm with thoughtful follow-through."
            >
              {sectionedContacts.plannedFollowUps.map((contact) =>
                renderContactCard(contact),
              )}
            </ContactSection>
          ) : null}

          {sectionedContacts.recentConnections.length > 0 ? (
            <ContactSection
              title="Fresh momentum"
              description="People you have spoken with recently and may want to carry forward while the connection is still active."
            >
              {sectionedContacts.recentConnections.map((contact) =>
                renderContactCard(contact),
              )}
            </ContactSection>
          ) : null}

          {sectionedContacts.allContacts.length > 0 ? (
            <ContactSection title="Trusted network">
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
