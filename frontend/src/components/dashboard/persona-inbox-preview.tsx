"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, ArrowUpRight, MessagesSquare } from "lucide-react";

import { listConversationsForIdentity } from "@/lib/api/connections";
import { personaApi } from "@/lib/api/persona-api";
import { routes } from "@/lib/constants/routes";
import { useShareFastSnapshot } from "@/lib/share-fast-store";
import type { IdentityConversationContext } from "@/types/conversation";
import type { PersonaSummary } from "@/types/persona";

function formatConversationLabel(conversation: IdentityConversationContext) {
  if (conversation.title) {
    return conversation.title;
  }

  if (conversation.personaId) {
    return "Persona-routed thread";
  }

  return "Direct thread";
}

function formatTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "Recently updated";
  }
}

export function PersonaInboxPreview() {
  const snapshot = useShareFastSnapshot();
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [conversations, setConversations] = useState<
    IdentityConversationContext[]
  >([]);
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
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load personas.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activePersona = useMemo(() => {
    const selectedPersonaId = snapshot.selectedPersonaId;

    if (selectedPersonaId) {
      return (
        personas.find((persona) => persona.id === selectedPersonaId) ?? null
      );
    }

    return personas.find((persona) => persona.isPrimary) ?? personas[0] ?? null;
  }, [personas, snapshot.selectedPersonaId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      if (!activePersona?.identityId) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await listConversationsForIdentity(
          activePersona.identityId,
          undefined,
          activePersona.id,
        );

        if (!cancelled) {
          setConversations(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load persona inbox.",
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
  }, [activePersona?.id, activePersona?.identityId]);

  return (
    <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
            Persona inbox
          </p>
          <h2 className="mt-3 text-[26px] font-bold tracking-tighter text-foreground sm:text-[30px]">
            {activePersona ? `@${activePersona.username}` : "No active persona"}
          </h2>
          <p className="mt-2 max-w-[42ch] text-[15px] font-medium leading-relaxed text-muted">
            Preview the conversation threads routed into the active persona
            instead of the full identity-wide inbox.
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
          <Inbox className="h-5 w-5 text-foreground" strokeWidth={2} />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="rounded-[1.25rem] border border-black/5 bg-black/[0.02] px-4 py-5 text-[14px] font-medium text-muted dark:border-white/10 dark:bg-white/[0.03]">
            Loading persona inbox...
          </div>
        ) : error ? (
          <div className="rounded-[1.25rem] border border-rose-500/20 bg-rose-500/8 px-4 py-5 text-[14px] font-medium text-rose-600 dark:text-rose-300">
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-[1.25rem] border border-black/5 bg-black/[0.02] px-4 py-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start gap-3">
              <MessagesSquare
                className="mt-0.5 h-4 w-4 text-muted"
                strokeWidth={2}
              />
              <div>
                <p className="text-[14px] font-semibold text-foreground">
                  {activePersona
                    ? "No routed threads yet."
                    : "No persona selected yet."}
                </p>
                <p className="mt-1 text-[14px] font-medium leading-relaxed text-muted">
                  {activePersona
                    ? "After you share this persona, new requests and routed conversations will start showing up here."
                    : "Create a persona first so Dotly has a profile and QR to route replies into."}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={activePersona ? routes.app.qr : routes.app.createPersona}
                    className="inline-flex items-center justify-center rounded-full border border-black/5 bg-black/[0.04] px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    {activePersona ? "Open share QR" : "Create persona"}
                  </Link>
                  <Link
                    href={routes.app.requests}
                    className="inline-flex items-center justify-center rounded-full border border-black/5 bg-transparent px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]"
                  >
                    Review requests
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          conversations.slice(0, 4).map((conversation) => (
            <Link
              key={conversation.conversationId}
              href={routes.app.conversationDetail(conversation.conversationId)}
              className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-black/5 bg-black/[0.02] px-4 py-4 transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-foreground">
                  {formatConversationLabel(conversation)}
                </p>
                <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.12em] text-muted">
                  {conversation.conversationType.replaceAll("_", " ")}
                </p>
              </div>

              <div className="flex items-center gap-3 text-muted">
                <span className="text-[13px] font-medium">
                  {formatTimestamp(conversation.updatedAt)}
                </span>
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-[1.25rem] border border-black/5 bg-black/[0.03] px-4 py-3 text-[14px] font-medium text-muted dark:border-white/10 dark:bg-white/[0.04]">
        <span>
          {activePersona?.routingKey
            ? `Routing key: #${activePersona.routingKey}`
            : "Default persona inbox"}
        </span>
        <span className="font-semibold text-foreground">
          {conversations.length} thread{conversations.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
