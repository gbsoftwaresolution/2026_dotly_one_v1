"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Inbox,
  Layers3,
  MessagesSquare,
  RotateCcw,
  ShieldCheck,
  Archive,
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
import { getIdentityInbox, getIdentityTeamAccess } from "@/lib/api/identities";
import { updateConversationStatus } from "@/lib/api/connections";
import { personaApi } from "@/lib/api/persona-api";
import { routes } from "@/lib/constants/routes";
import { useShareFastSnapshot } from "@/lib/share-fast-store";
import {
  ConversationStatus,
  type IdentityConversationContext,
} from "@/types/conversation";
import type { IdentityTeamAccessPayload } from "@/types/identity";
import type { PersonaSummary } from "@/types/persona";

type StatusFilter = "all" | ConversationStatus;
type PersonaFilter = "all" | string;
type TeamAccessState = "idle" | "loading" | "ready" | "locked" | "error";

interface PersonaGroup {
  key: string;
  persona: PersonaSummary | null;
  items: IdentityConversationContext[];
  archivedCount: number;
  latestUpdatedAt: string | null;
}

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Everything" },
  { value: ConversationStatus.Active, label: "Active queue" },
  { value: ConversationStatus.Archived, label: "Archived" },
  { value: ConversationStatus.Blocked, label: "Blocked" },
  { value: ConversationStatus.Locked, label: "Locked" },
];

function parseStatusFilter(value: string | null): StatusFilter {
  return STATUS_FILTERS.some((filter) => filter.value === value)
    ? (value as StatusFilter)
    : "all";
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Recently updated";
  }
}

function formatConversationTitle(conversation: IdentityConversationContext) {
  if (conversation.title) {
    return conversation.title;
  }

  if (conversation.personaId) {
    return "Persona-routed thread";
  }

  return "Direct thread";
}

function formatStatusLabel(status: ConversationStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function statusTone(status: ConversationStatus) {
  if (status === ConversationStatus.Active) {
    return "success" as const;
  }

  if (status === ConversationStatus.Archived) {
    return "neutral" as const;
  }

  return "warning" as const;
}

function sortConversations(
  conversations: IdentityConversationContext[],
): IdentityConversationContext[] {
  return [...conversations].sort((left, right) => {
    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

function countByStatus(
  conversations: IdentityConversationContext[],
  status: ConversationStatus,
) {
  return conversations.filter(
    (conversation) => conversation.conversationStatus === status,
  ).length;
}

function groupConversations(
  conversations: IdentityConversationContext[],
  identityPersonas: PersonaSummary[],
  activePersonaId?: string | null,
): PersonaGroup[] {
  const groups = new Map<string, IdentityConversationContext[]>();

  for (const conversation of sortConversations(conversations)) {
    const key = conversation.personaId ?? "identity-default";
    const current = groups.get(key) ?? [];
    current.push(conversation);
    groups.set(key, current);
  }

  return Array.from(groups.entries())
    .map(([key, items]) => {
      const persona =
        identityPersonas.find((candidate) => candidate.id === key) ?? null;

      return {
        key,
        persona,
        items,
        archivedCount: countByStatus(items, ConversationStatus.Archived),
        latestUpdatedAt: items[0]?.updatedAt ?? null,
      };
    })
    .sort((left, right) => {
      const leftIsActive = left.persona?.id === activePersonaId;
      const rightIsActive = right.persona?.id === activePersonaId;

      if (leftIsActive !== rightIsActive) {
        return leftIsActive ? -1 : 1;
      }

      const leftIsDefault = left.persona?.isDefaultRouting ?? false;
      const rightIsDefault = right.persona?.isDefaultRouting ?? false;

      if (leftIsDefault !== rightIsDefault) {
        return leftIsDefault ? -1 : 1;
      }

      if (left.items.length !== right.items.length) {
        return right.items.length - left.items.length;
      }

      return left.key.localeCompare(right.key);
    });
}

function matchesStatus(
  conversation: IdentityConversationContext,
  statusFilter: StatusFilter,
) {
  return (
    statusFilter === "all" || conversation.conversationStatus === statusFilter
  );
}

function matchesPersona(
  conversation: IdentityConversationContext,
  personaFilter: PersonaFilter,
) {
  if (personaFilter === "all") {
    return true;
  }

  if (personaFilter === "identity-default") {
    return conversation.personaId == null;
  }

  return conversation.personaId === personaFilter;
}

function personaFilterLabel(group: PersonaGroup) {
  return group.persona ? `@${group.persona.username}` : "Identity default";
}

function getGroupHeading(group: PersonaGroup) {
  if (!group.persona) {
    return "Identity inbox";
  }

  return `@${group.persona.username}`;
}

function getGroupDescription(group: PersonaGroup) {
  if (!group.persona) {
    return "Conversations that stay with the main Dotly identity when the first exchange does not need a dedicated persona.";
  }

  if (group.persona.routingKey) {
    return `${group.persona.fullName || "This persona"} is receiving introductions through #${group.persona.routingKey}.`;
  }

  return `${group.persona.fullName || "This persona"} stays visible here wherever your curated access settings allow it.`;
}

function getConversationRouteLabel(conversation: IdentityConversationContext) {
  return conversation.personaId ? "Persona route" : "Identity inbox";
}

function getConversationSupportCopy(conversation: IdentityConversationContext) {
  switch (conversation.conversationStatus) {
    case ConversationStatus.Archived:
      return "Moved out of the live lane, with the context preserved for clean follow-through.";
    case ConversationStatus.Blocked:
      return "Held back by a trust or protection rule before the conversation can move forward.";
    case ConversationStatus.Locked:
      return "Visible for context while access is still being intentionally held back.";
    default:
      return "Ready for a timely reply while the first exchange is still warm.";
  }
}

export function InboxScreen() {
  const { activeIdentity, isLoading: isIdentityLoading } = useIdentityContext();
  const searchParams = useSearchParams();
  const snapshot = useShareFastSnapshot();
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [conversations, setConversations] = useState<
    IdentityConversationContext[]
  >([]);
  const [teamAccess, setTeamAccess] =
    useState<IdentityTeamAccessPayload | null>(null);
  const [teamAccessState, setTeamAccessState] =
    useState<TeamAccessState>("idle");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [personaFilter, setPersonaFilter] = useState<PersonaFilter>("all");
  const [statusChangeByConversationId, setStatusChangeByConversationId] =
    useState<Record<string, boolean>>({});
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    personaApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setPersonas(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonas([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const identityPersonas = useMemo(
    () =>
      personas.filter((persona) => persona.identityId === activeIdentity?.id),
    [personas, activeIdentity?.id],
  );

  const activePersona = useMemo(() => {
    if (!activeIdentity) {
      return null;
    }

    if (snapshot.selectedPersonaId) {
      const selected = identityPersonas.find(
        (persona) => persona.id === snapshot.selectedPersonaId,
      );

      if (selected) {
        return selected;
      }
    }

    return (
      identityPersonas.find((persona) => persona.isDefaultRouting) ??
      identityPersonas.find((persona) => persona.isPrimary) ??
      identityPersonas[0] ??
      null
    );
  }, [activeIdentity, identityPersonas, snapshot.selectedPersonaId]);

  useEffect(() => {
    if (!activeIdentity?.id) {
      setStatusFilter("all");
      setPersonaFilter("all");
      return;
    }

    setStatusFilter(parseStatusFilter(searchParams.get("status")));

    const requestedPersona = searchParams.get("persona");
    setPersonaFilter(
      requestedPersona && requestedPersona.length > 0
        ? requestedPersona
        : "all",
    );
  }, [activeIdentity?.id, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      if (isIdentityLoading) {
        return;
      }

      if (!activeIdentity) {
        if (!cancelled) {
          setConversations([]);
          setError(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await getIdentityInbox({
          identityId: activeIdentity.id,
        });

        if (!cancelled) {
          setConversations(sortConversations(data));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load inbox.",
          );
          setConversations([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInbox();

    return () => {
      cancelled = true;
    };
  }, [activeIdentity, isIdentityLoading, reloadNonce]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamAccess() {
      if (isIdentityLoading) {
        return;
      }

      if (!activeIdentity) {
        if (!cancelled) {
          setTeamAccess(null);
          setTeamAccessState("idle");
        }
        return;
      }

      setTeamAccessState("loading");

      try {
        const data = await getIdentityTeamAccess(activeIdentity.id);

        if (!cancelled) {
          setTeamAccess(data);
          setTeamAccessState("ready");
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setTeamAccess(null);
        setTeamAccessState(
          loadError instanceof ApiError && loadError.status === 403
            ? "locked"
            : "error",
        );
      }
    }

    void loadTeamAccess();

    return () => {
      cancelled = true;
    };
  }, [activeIdentity, isIdentityLoading]);

  const conversationsByStatus = useMemo(() => {
    return {
      all: conversations.length,
      [ConversationStatus.Active]: countByStatus(
        conversations,
        ConversationStatus.Active,
      ),
      [ConversationStatus.Archived]: countByStatus(
        conversations,
        ConversationStatus.Archived,
      ),
      [ConversationStatus.Blocked]: countByStatus(
        conversations,
        ConversationStatus.Blocked,
      ),
      [ConversationStatus.Locked]: countByStatus(
        conversations,
        ConversationStatus.Locked,
      ),
    };
  }, [conversations]);

  const statusFilteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        matchesStatus(conversation, statusFilter),
      ),
    [conversations, statusFilter],
  );

  const personaGroups = useMemo(
    () =>
      groupConversations(
        statusFilteredConversations,
        identityPersonas,
        activePersona?.id,
      ),
    [statusFilteredConversations, identityPersonas, activePersona?.id],
  );

  useEffect(() => {
    if (
      personaFilter !== "all" &&
      !personaGroups.some((group) => group.key === personaFilter)
    ) {
      setPersonaFilter("all");
    }
  }, [personaFilter, personaGroups]);

  const visibleConversations = useMemo(
    () =>
      statusFilteredConversations.filter((conversation) =>
        matchesPersona(conversation, personaFilter),
      ),
    [statusFilteredConversations, personaFilter],
  );

  const visibleGroups = useMemo(
    () =>
      groupConversations(
        visibleConversations,
        identityPersonas,
        activePersona?.id,
      ),
    [visibleConversations, identityPersonas, activePersona?.id],
  );

  const visibleArchivedCount = useMemo(
    () => countByStatus(visibleConversations, ConversationStatus.Archived),
    [visibleConversations],
  );

  const visibleActiveCount = useMemo(
    () => countByStatus(visibleConversations, ConversationStatus.Active),
    [visibleConversations],
  );

  const visibleRoutedCount = useMemo(
    () =>
      visibleConversations.filter((conversation) => conversation.personaId)
        .length,
    [visibleConversations],
  );

  const visibleDirectCount = visibleConversations.length - visibleRoutedCount;

  const teamAccessSummary = useMemo(() => {
    const entries = teamAccess
      ? [...teamAccess.members, ...teamAccess.operators]
      : [];

    return {
      restrictedSeats: entries.filter(
        (entry) => entry.accessMode === "restricted",
      ).length,
      fullSeats: entries.filter((entry) => entry.accessMode === "full").length,
    };
  }, [teamAccess]);

  const personaFilterTitle = useMemo(() => {
    if (personaFilter === "all") {
      return "All persona groups";
    }

    const matchingGroup = personaGroups.find(
      (group) => group.key === personaFilter,
    );

    return matchingGroup ? personaFilterLabel(matchingGroup) : "Selected group";
  }, [personaFilter, personaGroups]);

  const emptyFilterDescription =
    statusFilter === "all" && personaFilter === "all"
      ? "Conversations for this Dotly will appear here as soon as a first exchange opens or a live thread returns to view."
      : `No threads match ${personaFilterTitle.toLowerCase()} with the current ${
          statusFilter === "all"
            ? "conversation lens"
            : `${formatStatusLabel(statusFilter).toLowerCase()} filter`
        }.`;

  async function handleConversationStatusChange(
    conversation: IdentityConversationContext,
    nextStatus: ConversationStatus,
  ) {
    setStatusChangeByConversationId((current) => ({
      ...current,
      [conversation.conversationId]: true,
    }));

    try {
      const updatedConversation = await updateConversationStatus(
        conversation.conversationId,
        nextStatus,
      );

      setConversations((current) =>
        sortConversations(
          current.map((entry) =>
            entry.conversationId === conversation.conversationId
              ? updatedConversation
              : entry,
          ),
        ),
      );

      showToast(
        nextStatus === ConversationStatus.Archived
          ? "Thread moved to archived history"
          : "Thread returned to the active queue",
      );
    } catch (statusError) {
      showToast({
        message:
          statusError instanceof Error
            ? statusError.message
            : "Could not update thread status.",
        tone: "error",
      });
    } finally {
      setStatusChangeByConversationId((current) => ({
        ...current,
        [conversation.conversationId]: false,
      }));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description="Stay close to every first exchange, with persona context, curated access, and deliberate follow-through in one place."
        action={<IdentitySwitcher />}
        large
      />

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
              <Inbox className="h-5 w-5 text-foreground" strokeWidth={2} />
            </div>
            <div className="space-y-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                First exchange lens
              </p>
              <h2 className="text-[26px] font-bold tracking-tighter text-foreground">
                {activePersona
                  ? `@${activePersona.username}`
                  : activeIdentity
                    ? "Identity-wide inbox"
                    : "No active identity"}
              </h2>
              <p className="max-w-[48ch] text-[15px] font-medium leading-relaxed text-muted">
                {activePersona
                  ? "Lead with the active Dotly first, while the rest of the trust network stays close behind for elegant follow-through."
                  : "No persona is leading yet, so Dotly keeps the conversation view at the identity level until a route is chosen."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Visible threads
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight tracking-tight tracking-tight text-foreground">
                {visibleConversations.length}
              </p>
              <p className="mt-1 text-sm text-muted">
                {conversations.length === visibleConversations.length
                  ? "Across this curated conversation view"
                  : `${conversations.length} total before filters`}
              </p>
            </div>

            <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Active now
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight tracking-tight tracking-tight text-foreground">
                {visibleActiveCount}
              </p>
              <p className="mt-1 text-sm text-muted">
                Ready for timely follow-through
              </p>
            </div>

            <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Archived
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight tracking-tight tracking-tight text-foreground">
                {visibleArchivedCount}
              </p>
              <p className="mt-1 text-sm text-muted">
                Saved context beyond the live moment
              </p>
            </div>

            <div className="rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Persona groups
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight tracking-tight tracking-tight text-foreground">
                {visibleGroups.length}
              </p>
              <p className="mt-1 text-sm text-muted">
                {visibleRoutedCount} persona-led · {visibleDirectCount}{" "}
                identity-led
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                Curated access
              </p>
              <h2 className="mt-3 text-[22px] font-bold tracking-tighter text-foreground">
                Keep every route intentional
              </h2>
            </div>
            <Layers3 className="h-5 w-5 text-muted" strokeWidth={2} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPersonaFilter("all")}
              className={[
                "rounded-pill px-4 py-2 text-sm font-semibold transition-colors ring-1",
                personaFilter === "all"
                  ? "bg-foreground text-background ring-black/10 dark:bg-white dark:text-slate-950 dark:ring-white/10"
                  : "bg-foreground/[0.03] text-muted ring-black/5 hover:text-foreground dark:bg-white/[0.045] dark:ring-white/10",
              ].join(" ")}
            >
              All · {statusFilteredConversations.length}
            </button>

            {personaGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => setPersonaFilter(group.key)}
                className={[
                  "rounded-pill px-4 py-2 text-sm font-semibold transition-colors ring-1",
                  personaFilter === group.key
                    ? "bg-foreground text-background ring-black/10 dark:bg-white dark:text-slate-950 dark:ring-white/10"
                    : "bg-foreground/[0.03] text-muted ring-black/5 hover:text-foreground dark:bg-white/[0.045] dark:ring-white/10",
                ].join(" ")}
              >
                {personaFilterLabel(group)} · {group.items.length}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[1.15rem] border border-black/5 bg-white/70 px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-black/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                <ShieldCheck
                  className="h-4 w-4 text-foreground"
                  strokeWidth={2}
                />
              </div>

              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Visibility guardrails
                </p>
                <p className="text-sm leading-6 text-muted">
                  Dotly only shows the conversations this identity and its trust
                  settings are meant to carry.
                </p>

                {teamAccessState === "ready" ? (
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      label={`${teamAccessSummary.restrictedSeats} restricted seat${
                        teamAccessSummary.restrictedSeats === 1 ? "" : "s"
                      }`}
                      tone="cyan"
                    />
                    <StatusBadge
                      label={`${teamAccessSummary.fullSeats} full seat${
                        teamAccessSummary.fullSeats === 1 ? "" : "s"
                      }`}
                      tone="neutral"
                    />
                  </div>
                ) : teamAccessState === "locked" ? (
                  <p className="text-sm leading-6 text-muted">
                    Identity owners and admins shape the access model, while
                    this inbox still reflects the enforced view.
                  </p>
                ) : teamAccessState === "error" ? (
                  <p className="text-sm leading-6 text-muted">
                    Team access details are unavailable right now, but the
                    visible conversations still respect the live trust scope.
                  </p>
                ) : teamAccessState === "loading" ? (
                  <p className="text-sm leading-6 text-muted">
                    Checking who can carry each conversation forward...
                  </p>
                ) : null}
              </div>
            </div>

            <Link
              href={routes.app.inboxAssignments}
              className="mt-4 flex items-center justify-between gap-3 rounded-[1.05rem] border border-black/5 bg-black/[0.03] px-4 py-3 text-left transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {teamAccessState === "ready"
                    ? "Shape team coverage"
                    : "Review access scope"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Owner and admin controls for persona visibility, curated
                  coverage, and who carries the relationship next.
                </p>
              </div>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-muted"
                strokeWidth={2}
              />
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Relationship momentum
            </p>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Keep the warm conversations moving
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const count =
                filter.value === "all"
                  ? conversationsByStatus.all
                  : conversationsByStatus[filter.value];

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={[
                    "rounded-pill px-4 py-2 text-sm font-semibold transition-colors ring-1",
                    statusFilter === filter.value
                      ? "bg-foreground text-background ring-black/10 dark:bg-white dark:text-slate-950 dark:ring-white/10"
                      : "bg-foreground/[0.03] text-muted ring-black/5 hover:text-foreground dark:bg-white/[0.045] dark:ring-white/10",
                  ].join(" ")}
                >
                  {filter.label} · {count}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!isIdentityLoading && !activeIdentity ? (
        <EmptyState
          title="Choose an identity"
          description="Select the Dotly identity you want to represent so the right conversations, routes, and access context come into view."
          action={<IdentitySwitcher />}
        />
      ) : isLoading ? (
        <div className="space-y-3 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
          <div className="space-y-1 px-1 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Loading queue
            </p>
            <p className="text-sm text-muted">
              Pulling live conversations, current momentum, and access context
              for this Dotly.
            </p>
          </div>
          {[...Array(4)].map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Inbox temporarily unavailable"
          description={`${error} Try again to bring your active conversations and access context back into view.`}
          action={
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => setReloadNonce((current) => current + 1)}
            >
              Try again
            </SecondaryButton>
          }
        />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations here yet"
          description="New introductions will appear here as soon as someone opens a conversation with this Dotly or one of its personas."
        />
      ) : visibleGroups.length === 0 ? (
        <EmptyState
          title="No conversations match this view"
          description={emptyFilterDescription}
          action={
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setPersonaFilter("all");
              }}
            >
              Clear filters
            </SecondaryButton>
          }
        />
      ) : (
        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                    {getGroupHeading(group)}
                  </h2>
                  <p className="text-sm leading-6 text-muted">
                    {getGroupDescription(group)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={`${group.items.length} thread${group.items.length === 1 ? "" : "s"}`}
                    tone="neutral"
                  />
                  {group.archivedCount > 0 ? (
                    <StatusBadge
                      label={`${group.archivedCount} archived`}
                      tone="neutral"
                    />
                  ) : null}
                  {group.latestUpdatedAt ? (
                    <StatusBadge
                      label={`Updated ${formatDate(group.latestUpdatedAt)}`}
                      tone="cyan"
                    />
                  ) : null}
                  {group.persona?.isDefaultRouting ? (
                    <StatusBadge label="Default route" tone="violet" />
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: "active-lane",
                    title: "Active lane",
                    description:
                      "Conversations still carrying live momentum for this route.",
                    items: group.items.filter(
                      (conversation) =>
                        conversation.conversationStatus !==
                        ConversationStatus.Archived,
                    ),
                  },
                  {
                    key: "archived-lane",
                    title: "Archived history",
                    description:
                      "Conversations moved out of the live lane while keeping the relationship context intact.",
                    items: group.items.filter(
                      (conversation) =>
                        conversation.conversationStatus ===
                        ConversationStatus.Archived,
                    ),
                  },
                ]
                  .filter((section) => section.items.length > 0)
                  .map((section) => (
                    <div key={section.key} className="space-y-2">
                      {statusFilter === "all" &&
                      group.items.length !== section.items.length ? (
                        <div className="flex flex-wrap items-center gap-2 px-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                            {section.title}
                          </p>
                          <p className="text-sm text-muted">
                            {section.description}
                          </p>
                        </div>
                      ) : null}

                      <div className="overflow-hidden rounded-[1.5rem] bg-foreground/[0.02] shadow-sm ring-[0.5px] ring-black/5 backdrop-blur-[40px] saturate-[200%] divide-y divide-black/5 dark:bg-white/[0.03] dark:ring-white/10 dark:divide-white/5">
                        {section.items.map((conversation) => {
                          const isUpdating =
                            statusChangeByConversationId[
                              conversation.conversationId
                            ] === true;
                          const nextStatus =
                            conversation.conversationStatus ===
                            ConversationStatus.Archived
                              ? ConversationStatus.Active
                              : conversation.conversationStatus ===
                                  ConversationStatus.Active
                                ? ConversationStatus.Archived
                                : null;
                          const detailHref = `${routes.app.conversationDetail(
                            conversation.conversationId,
                          )}?${new URLSearchParams({
                            persona:
                              personaFilter !== "all"
                                ? personaFilter
                                : group.key,
                            ...(statusFilter !== "all"
                              ? { status: statusFilter }
                              : {}),
                          }).toString()}`;

                          return (
                            <div
                              key={conversation.conversationId}
                              className="flex flex-col gap-3 p-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between rounded-[20px] transition-all duration-300 hover:bg-white/40 dark:hover:bg-zinc-800/40"
                            >
                              <Link
                                href={detailHref}
                                className="min-w-0 flex-1"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-[15px] font-semibold text-foreground">
                                    {formatConversationTitle(conversation)}
                                  </p>
                                  <StatusBadge
                                    label={formatStatusLabel(
                                      conversation.conversationStatus,
                                    )}
                                    tone={statusTone(
                                      conversation.conversationStatus,
                                    )}
                                    dot={
                                      conversation.conversationStatus ===
                                      ConversationStatus.Active
                                    }
                                  />
                                  <StatusBadge
                                    label={getConversationRouteLabel(
                                      conversation,
                                    )}
                                    tone={
                                      conversation.personaId
                                        ? "cyan"
                                        : "neutral"
                                    }
                                  />
                                  <span className="rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted dark:border-white/10 dark:bg-white/[0.04]">
                                    {conversation.conversationType.replaceAll(
                                      "_",
                                      " ",
                                    )}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm font-medium text-muted">
                                  Updated {formatDate(conversation.updatedAt)}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-muted">
                                  {getConversationSupportCopy(conversation)}
                                </p>
                              </Link>

                              <div className="flex items-center justify-between gap-2 sm:justify-end">
                                <div className="flex items-center gap-2 text-muted">
                                  <MessagesSquare
                                    className="h-4 w-4"
                                    strokeWidth={2}
                                  />
                                  <ArrowUpRight
                                    className="h-4 w-4"
                                    strokeWidth={2}
                                  />
                                </div>
                                {nextStatus ? (
                                  <SecondaryButton
                                    type="button"
                                    size="sm"
                                    isLoading={isUpdating}
                                    onClick={() =>
                                      void handleConversationStatusChange(
                                        conversation,
                                        nextStatus,
                                      )
                                    }
                                  >
                                    {nextStatus ===
                                    ConversationStatus.Archived ? (
                                      <span className="inline-flex items-center gap-2">
                                        <Archive className="h-4 w-4" />
                                        Archive
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-2">
                                        <RotateCcw className="h-4 w-4" />
                                        Restore
                                      </span>
                                    )}
                                  </SecondaryButton>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
