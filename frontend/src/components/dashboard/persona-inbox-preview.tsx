"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Inbox, MessagesSquare } from "lucide-react";

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
    return "Recently";
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
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error loading");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activePersona = useMemo(() => {
    const selectedPersonaId = snapshot.selectedPersonaId;
    if (selectedPersonaId) {
      return personas.find((p) => p.id === selectedPersonaId) ?? null;
    }
    return personas.find((p) => p.isPrimary) ?? personas[0] ?? null;
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
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error");
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
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-widest text-foreground/50">
            Inbox Preview
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {activePersona ? `@${activePersona.username}` : "No persona"}
          </h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
          <Inbox className="h-5 w-5 text-foreground/70" />
        </div>
      </div>

      <div className="space-y-3 flex-1">
        {isLoading ? (
          <div className="text-[14px] font-medium text-foreground/40">
            Syncing messages...
          </div>
        ) : error ? (
          <div className="text-[14px] font-medium text-rose-500/80">
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-start gap-3">
            <MessagesSquare className="h-5 w-5 text-foreground/40 mt-0.5" />
            <div>
              <p className="text-[15px] font-semibold text-foreground/80">
                It&apos;s quiet here.
              </p>
              <p className="text-[14px] text-foreground/50 mt-1 max-w-[24ch]">
                Share your persona to start seeing routed requests.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.slice(0, 3).map((conv) => (
              <Link
                key={conv.conversationId}
                href={routes.app.conversationDetail(conv.conversationId)}
                className="group flex items-center justify-between rounded-2xl bg-black/5 p-4 transition-transform hover:scale-[1.02] dark:bg-white/5"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {formatConversationLabel(conv)}
                  </p>
                  <p className="mt-0.5 text-[13px] text-foreground/50">
                    {formatTimestamp(conv.updatedAt)}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-black/5 pt-4 dark:border-white/10">
        <span className="text-[13px] font-medium text-foreground/50">
          {conversations.length} active threads
        </span>
        <Link
          href={routes.app.inbox}
          className="text-[13px] font-semibold text-foreground hover:underline"
        >
          View All
        </Link>
      </div>
    </div>
  );
}
