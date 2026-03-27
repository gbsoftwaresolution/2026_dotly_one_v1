"use client";

import { useEffect, useState } from "react";

import { ProtectedConversationScreen } from "@/components/connections/protected/protected-conversation-screen";
import { getConversationContext } from "@/lib/api/connections";
import { personaApi } from "@/lib/api/persona-api";
import type { IdentityConversationContext } from "@/types/conversation";
import type { PersonaSummary } from "@/types/persona";

interface ConversationDetailRouteProps {
  conversationId: string;
  variant: "app" | "app-old";
}

export function ConversationDetailRoute({
  conversationId,
  variant,
}: ConversationDetailRouteProps) {
  const [conversation, setConversation] =
    useState<IdentityConversationContext | null>(null);
  const [routingPersona, setRoutingPersona] = useState<PersonaSummary | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setIsLoading(true);
      setError(null);

      try {
        const nextConversation = await getConversationContext(conversationId);

        if (cancelled) {
          return;
        }

        setConversation(nextConversation);

        if (nextConversation.personaId) {
          const persona = await personaApi.get(nextConversation.personaId).catch(
            () => null,
          );

          if (!cancelled) {
            setRoutingPersona(persona);
          }
        } else if (!cancelled) {
          setRoutingPersona(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setConversation(null);
          setRoutingPersona(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load conversation.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-[1.75rem] bg-foreground/[0.02] p-4 shadow-inner ring-1 ring-inset ring-black/5 dark:bg-white/[0.03] dark:ring-white/5 sm:rounded-3xl sm:p-5">
        <div className="h-8 w-44 rounded-2xl bg-slate-200/80 animate-pulse dark:bg-white/10" />
        <div className="h-40 w-full rounded-[1.75rem] bg-slate-200/80 animate-pulse dark:bg-white/10" />
        <div className="h-[28rem] w-full rounded-[1.75rem] bg-slate-200/80 animate-pulse dark:bg-white/10" />
      </div>
    );
  }

  if (error || !conversation?.connectionId) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-center shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 sm:p-8">
        <h1 className="text-xl font-bold text-rose-900 dark:text-rose-100">
          Failed to load conversation
        </h1>
        <p className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-200">
          {error || "Conversation not found."}
        </p>
      </div>
    );
  }

  return (
    <ProtectedConversationScreen
      connectionId={conversation.connectionId}
      conversation={conversation}
      routingPersona={routingPersona}
      navigationVariant={variant}
    />
  );
}