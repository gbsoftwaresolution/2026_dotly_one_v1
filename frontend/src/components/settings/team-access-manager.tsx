"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Shield,
  Users,
  UserRoundCog,
  Waypoints,
} from "lucide-react";

import { IdentitySwitcher } from "@/components/identities/identity-switcher";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { showToast } from "@/components/shared/toast-viewport";
import { useIdentityContext } from "@/context/IdentityContext";
import { ApiError } from "@/lib/api/client";
import {
  getIdentityTeamAccess,
  updateIdentityMemberPersonaAssignments,
  updateIdentityOperatorPersonaAssignments,
} from "@/lib/api/identities";
import { routes } from "@/lib/constants/routes";
import type {
  IdentityTeamAccessEntry,
  IdentityTeamAccessPayload,
  IdentityTeamAccessPersona,
} from "@/types/identity";

type EntryKind = "member" | "operator";

type TeamAccessFeedbackTone = "success" | "error" | "neutral";

function isManageAccessError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 403
  );
}

function entryKey(kind: EntryKind, entryId: string) {
  return `${kind}:${entryId}`;
}

function sortIds(ids: string[]) {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function idsMatch(left: string[], right: string[]) {
  const normalizedLeft = sortIds(left);
  const normalizedRight = sortIds(right);

  return normalizedLeft.join("|") === normalizedRight.join("|");
}

function roleTone(role: string) {
  if (role === "OWNER" || role === "SUPER_ADMIN") {
    return "violet" as const;
  }

  if (role === "ADMIN") {
    return "cyan" as const;
  }

  return "neutral" as const;
}

function sectionConfig(kind: EntryKind) {
  if (kind === "member") {
    return {
      title: "Members",
      description: "Owners and collaborators attached to this identity.",
      icon: Users,
      emptyTitle: "No active members",
      emptyDescription:
        "Active members will appear here once they join this identity.",
      saveLabel: "Save member access",
    };
  }

  return {
    title: "Operators",
    description: "Admin and operator seats managing this identity.",
    icon: UserRoundCog,
    emptyTitle: "No active operators",
    emptyDescription:
      "Active operators will appear here once they are added to this identity.",
    saveLabel: "Save operator access",
  };
}

function replaceEntry(
  entries: IdentityTeamAccessEntry[],
  nextEntry: IdentityTeamAccessEntry,
) {
  return entries.map((entry) =>
    entry.id === nextEntry.id ? nextEntry : entry,
  );
}

export function TeamAccessManager() {
  const {
    activeIdentity,
    isLoading: isIdentityLoading,
  } = useIdentityContext();
  const [teamAccess, setTeamAccess] = useState<IdentityTeamAccessPayload | null>(
    null,
  );
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: TeamAccessFeedbackTone;
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamAccess() {
      if (isIdentityLoading) {
        return;
      }

      if (!activeIdentity) {
        if (!cancelled) {
          setTeamAccess(null);
          setDrafts({});
          setError(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      setFeedback(null);

      try {
        const nextTeamAccess = await getIdentityTeamAccess(activeIdentity.id);

        if (cancelled) {
          return;
        }

        setTeamAccess(nextTeamAccess);
        setDrafts(() => {
          const nextDrafts: Record<string, string[]> = {};

          for (const member of nextTeamAccess.members) {
            nextDrafts[entryKey("member", member.id)] = member.assignedPersonaIds;
          }

          for (const operator of nextTeamAccess.operators) {
            nextDrafts[entryKey("operator", operator.id)] =
              operator.assignedPersonaIds;
          }

          return nextDrafts;
        });
      } catch (loadError) {
        if (!cancelled) {
          setTeamAccess(null);
          setDrafts({});
          setError(
            isManageAccessError(loadError)
              ? "Only the identity owner, owner-members, and admin operators can manage persona inbox assignments."
              : loadError instanceof Error
                ? loadError.message
                : "Unable to load team access.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTeamAccess();

    return () => {
      cancelled = true;
    };
  }, [activeIdentity, isIdentityLoading]);

  const availablePersonas = teamAccess?.personas ?? [];
  const hasEntries =
    (teamAccess?.members.length ?? 0) > 0 ||
    (teamAccess?.operators.length ?? 0) > 0;
  const hasManageAccessError =
    error !== null &&
    error.includes("can manage persona inbox assignments");

  const activeIdentityLabel = useMemo(() => {
    if (teamAccess?.identity) {
      return teamAccess.identity.handle
        ? `${teamAccess.identity.displayName} · @${teamAccess.identity.handle}`
        : teamAccess.identity.displayName;
    }

    if (!activeIdentity) {
      return "No active identity";
    }

    return activeIdentity.handle
      ? `${activeIdentity.displayName} · @${activeIdentity.handle}`
      : activeIdentity.displayName;
  }, [activeIdentity, teamAccess]);

  function currentDraft(kind: EntryKind, entry: IdentityTeamAccessEntry) {
    return drafts[entryKey(kind, entry.id)] ?? entry.assignedPersonaIds;
  }

  function togglePersona(
    kind: EntryKind,
    entry: IdentityTeamAccessEntry,
    personaId: string,
  ) {
    const key = entryKey(kind, entry.id);

    setDrafts((current) => {
      const nextIds = new Set(current[key] ?? entry.assignedPersonaIds);

      if (nextIds.has(personaId)) {
        nextIds.delete(personaId);
      } else {
        nextIds.add(personaId);
      }

      return {
        ...current,
        [key]: Array.from(nextIds),
      };
    });
  }

  async function saveEntry(kind: EntryKind, entry: IdentityTeamAccessEntry) {
    if (!activeIdentity) {
      return;
    }

    const key = entryKey(kind, entry.id);
    const personaIds = currentDraft(kind, entry);

    setSavingKey(key);
    setFeedback(null);

    try {
      const updatedEntry =
        kind === "member"
          ? await updateIdentityMemberPersonaAssignments(
              activeIdentity.id,
              entry.id,
              personaIds,
            )
          : await updateIdentityOperatorPersonaAssignments(
              activeIdentity.id,
              entry.id,
              personaIds,
            );

      setTeamAccess((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          members:
            kind === "member"
              ? replaceEntry(current.members, updatedEntry)
              : current.members,
          operators:
            kind === "operator"
              ? replaceEntry(current.operators, updatedEntry)
              : current.operators,
        };
      });
      setDrafts((current) => ({
        ...current,
        [key]: updatedEntry.assignedPersonaIds,
      }));
      setFeedback({
        tone: "success",
        text:
          updatedEntry.accessMode === "full"
            ? "Assignments cleared. Legacy full inbox access is restored."
            : "Assignments saved. Inbox access is now persona-restricted.",
      });
      showToast({
        message: "Persona inbox access updated.",
        tone: "success",
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to update persona inbox access.";
      setFeedback({ tone: "error", text: message });
      showToast({ message, tone: "error" });
    } finally {
      setSavingKey(null);
    }
  }

  function renderPersonaSelection(
    kind: EntryKind,
    entry: IdentityTeamAccessEntry,
  ) {
    if (availablePersonas.length === 0) {
      return (
        <div className="rounded-[1.15rem] border border-dashed border-black/10 bg-black/[0.015] px-4 py-4 text-sm text-muted dark:border-white/10 dark:bg-white/[0.02]">
          No personas belong to this identity yet. Create a persona before you
          restrict inbox access.
        </div>
      );
    }

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {availablePersonas.map((persona) => {
          const selected = currentDraft(kind, entry).includes(persona.id);

          return (
            <label
              key={persona.id}
              className="flex cursor-pointer items-start gap-3 rounded-[1.15rem] border border-black/5 bg-black/[0.02] px-4 py-3 transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => togglePersona(kind, entry, persona.id)}
                className="mt-1 h-4 w-4 rounded border-black/20 text-foreground focus:ring-foreground/30 dark:border-white/20"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  @{persona.username}
                </span>
                <span className="block text-sm text-muted">
                  {persona.routingDisplayName || persona.fullName}
                </span>
                <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-muted">
                  {persona.isDefaultRouting
                    ? "Default route"
                    : persona.routingKey
                      ? `#${persona.routingKey}`
                      : "Persona route"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  function renderEntryCard(kind: EntryKind, entry: IdentityTeamAccessEntry) {
    const key = entryKey(kind, entry.id);
    const draftIds = currentDraft(kind, entry);
    const isDirty = !idsMatch(draftIds, entry.assignedPersonaIds);

    return (
      <article
        key={entry.id}
        className="rounded-[1.5rem] border border-black/5 bg-black/[0.02] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-base font-semibold tracking-tight text-foreground">
                {entry.email ?? entry.personId}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={entry.role.replaceAll("_", " ")} tone={roleTone(entry.role)} />
                <StatusBadge
                  label={
                    entry.accessMode === "full"
                      ? "Full inbox access"
                      : "Restricted inbox access"
                  }
                  tone={entry.accessMode === "full" ? "neutral" : "success"}
                  dot
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {entry.assignedPersonas.length === 0 ? (
                <span className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-xs font-semibold text-muted dark:border-white/10 dark:bg-white/[0.04]">
                  No assignments. Full legacy access remains in effect.
                </span>
              ) : (
                entry.assignedPersonas.map((persona) => (
                  <span
                    key={persona.id}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-status-success/20 dark:bg-status-success/10 dark:text-status-success"
                  >
                    @{persona.username}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 text-sm text-muted shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20 lg:max-w-[22rem]">
            Clearing every selection restores full legacy inbox access. Select
            one or more personas to restrict this seat to those inboxes only.
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {renderPersonaSelection(kind, entry)}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {draftIds.length === 0
                ? "No personas selected. Full identity inbox access will remain available."
                : `${draftIds.length} persona${draftIds.length === 1 ? "" : "s"} selected. Inbox access will be limited to those assignments.`}
            </p>

            <SecondaryButton
              type="button"
              isLoading={savingKey === key}
              disabled={!isDirty}
              onClick={() => {
                void saveEntry(kind, entry);
              }}
            >
              {sectionConfig(kind).saveLabel}
            </SecondaryButton>
          </div>
        </div>
      </article>
    );
  }

  function renderSection(kind: EntryKind, entries: IdentityTeamAccessEntry[]) {
    const config = sectionConfig(kind);
    const Icon = config.icon;

    return (
      <section className="space-y-4">
        <div className="flex items-start gap-4 rounded-[1.5rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
            <Icon className="h-5 w-5 text-foreground" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
              {config.title}
            </p>
            <h2 className="text-[24px] font-bold tracking-tighter text-foreground">
              {entries.length}
            </h2>
            <p className="text-sm leading-6 text-muted">{config.description}</p>
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            title={config.emptyTitle}
            description={config.emptyDescription}
          />
        ) : (
          <div className="space-y-4">{entries.map((entry) => renderEntryCard(kind, entry))}</div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Persona Inbox Assignments"
        description="Owner and admin controls for persona-scoped inbox coverage. Empty assignments preserve legacy full identity access."
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <Link
              href={routes.app.inbox}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/5 bg-foreground/[0.03] px-5 text-[15px] font-medium text-foreground shadow-sm backdrop-blur-xl transition-all duration-[140ms] ease-[0.16,1,0.3,1] hover:bg-foreground/[0.05] hover:scale-[0.98] dark:border-white/10 dark:bg-foreground/[0.05] dark:hover:bg-foreground/[0.08]"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back to inbox
            </Link>
            <IdentitySwitcher />
          </div>
        }
        large
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
              <Shield className="h-5 w-5 text-foreground" strokeWidth={2} />
            </div>
            <div className="space-y-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                Active identity
              </p>
              <h2 className="text-[26px] font-bold tracking-tighter text-foreground">
                {activeIdentityLabel}
              </h2>
              <p className="max-w-[46ch] text-[15px] font-medium leading-relaxed text-muted">
                Owners, owner-members, and admin operators can define which
                personas each seat can use inside the inbox.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
            Management scope
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 rounded-[1.15rem] border border-black/5 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                <ShieldCheck className="h-4 w-4 text-foreground" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Owner and admin management only
                </p>
                <p className="mt-1 text-sm text-muted">
                  Identity owners, owner-members, and admin operators can change assignment scope for each active seat.
                </p>
              </div>
            </div>
            <div className="rounded-[1.15rem] border border-black/5 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-semibold text-foreground">
                No persona assignments = full inbox access
              </p>
              <p className="mt-1 text-sm text-muted">
                This preserves the existing legacy behavior for active seats.
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-status-success/20 dark:bg-status-success/10">
              <p className="text-sm font-semibold text-foreground">
                Assigned personas only = restricted inbox access
              </p>
              <p className="mt-1 text-sm text-muted">
                Only conversations routed to the selected personas stay visible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className="rounded-[1.35rem] border border-black/5 bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <CheckCircle2
              className={feedback.tone === "error" ? "h-4 w-4 text-rose-600 dark:text-status-error" : "h-4 w-4 text-emerald-600 dark:text-status-success"}
              strokeWidth={2.4}
            />
            <p className="text-sm font-medium text-foreground">{feedback.text}</p>
          </div>
        </div>
      ) : null}

      {isIdentityLoading || isLoading ? (
        <div className="space-y-3 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
          {[...Array(4)].map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : !activeIdentity ? (
        <EmptyState
          title="No active identity"
          description="Choose an identity to review persona inbox assignments."
        />
      ) : hasManageAccessError ? (
        <EmptyState
          title="Owner or admin access required"
          description={error}
          action={
            <Link
              href={routes.app.inbox}
              className="inline-flex h-12 items-center justify-center rounded-full border border-black/5 bg-foreground/[0.03] px-6 text-[15px] font-medium text-foreground shadow-sm backdrop-blur-xl transition-all duration-[140ms] ease-[0.16,1,0.3,1] hover:bg-foreground/[0.05] hover:scale-[0.98] dark:border-white/10 dark:bg-foreground/[0.05] dark:hover:bg-foreground/[0.08]"
            >
              Return to inbox
            </Link>
          }
        />
      ) : error ? (
        <EmptyState title="Could not load team access" description={error} />
      ) : !hasEntries ? (
        <EmptyState
          title="No active team seats"
          description="Members and operators will appear here once this identity has active team access configured."
        />
      ) : (
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                <Waypoints className="h-5 w-5 text-foreground" strokeWidth={2} />
              </div>
              <div className="space-y-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                  Available personas
                </p>
                <div className="flex flex-wrap gap-2">
                  {availablePersonas.length === 0 ? (
                    <span className="text-sm text-muted">
                      No personas are attached to this identity yet.
                    </span>
                  ) : (
                    availablePersonas.map((persona: IdentityTeamAccessPersona) => (
                      <span
                        key={persona.id}
                        className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-xs font-semibold text-foreground dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        @{persona.username}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {renderSection("member", teamAccess?.members ?? [])}
          {renderSection("operator", teamAccess?.operators ?? [])}
        </div>
      )}
    </div>
  );
}