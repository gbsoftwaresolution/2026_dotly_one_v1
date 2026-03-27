"use client";

import { useCallback, useEffect, useState } from "react";

import {
  explainResolvedPermissions,
  getConnection,
  getConversationContext,
  getResolvedPermissions,
} from "@/lib/api/connections";
import { classifyAuthError } from "@/lib/utils/auth-errors";
import { personaApi } from "@/lib/api/persona-api";
import type { IdentityConnection, ResolvedPermissionsMap } from "@/types/connection";
import type { IdentityConversationContext } from "@/types/conversation";
import type { ResolvedPermissionsExplanation } from "@/types/permissions";
import type { PersonaSummary } from "@/types/persona";

type ConversationDetailErrorKind =
  | "forbidden"
  | "not-found"
  | "unauthorized"
  | "unknown";

interface ConversationDetailErrorState {
  kind: ConversationDetailErrorKind;
  message: string;
}

interface ConversationDetailDataState {
  conversation: IdentityConversationContext | null;
  routingPersona: PersonaSummary | null;
  connection: IdentityConnection | null;
  permissions: ResolvedPermissionsMap | null;
  permissionsExplanation: ResolvedPermissionsExplanation | null;
  isLoading: boolean;
  error: ConversationDetailErrorState | null;
  reload: () => void;
}

function toErrorState(error: unknown): ConversationDetailErrorState {
  const classified = classifyAuthError(error);

  return {
    kind:
      classified.kind === "forbidden" ||
      classified.kind === "not-found" ||
      classified.kind === "unauthorized"
        ? classified.kind
        : "unknown",
    message:
      error instanceof Error ? error.message : "Failed to load conversation.",
  };
}

export function useConversationDetailData(
  conversationId: string,
): ConversationDetailDataState {
  const [conversation, setConversation] =
    useState<IdentityConversationContext | null>(null);
  const [routingPersona, setRoutingPersona] = useState<PersonaSummary | null>(
    null,
  );
  const [connection, setConnection] = useState<IdentityConnection | null>(null);
  const [permissions, setPermissions] = useState<ResolvedPermissionsMap | null>(
    null,
  );
  const [permissionsExplanation, setPermissionsExplanation] =
    useState<ResolvedPermissionsExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ConversationDetailErrorState | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const reload = useCallback(() => {
    setReloadNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setIsLoading(true);
      setError(null);

      try {
        const nextConversation = await getConversationContext(conversationId);

        const [nextConnection, nextPermissions, nextPermissionsExplanation] =
          await Promise.all([
            getConnection(nextConversation.connectionId),
            getResolvedPermissions(nextConversation.connectionId),
            explainResolvedPermissions(nextConversation.connectionId),
          ]);

        const nextRoutingPersona = nextConversation.personaId
          ? await personaApi.get(nextConversation.personaId).catch(() => null)
          : null;

        if (cancelled) {
          return;
        }

        setConversation(nextConversation);
        setRoutingPersona(nextRoutingPersona);
        setConnection(nextConnection);
        setPermissions(nextPermissions);
        setPermissionsExplanation(nextPermissionsExplanation);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setConversation(null);
        setRoutingPersona(null);
        setConnection(null);
        setPermissions(null);
        setPermissionsExplanation(null);
        setError(toErrorState(loadError));
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
  }, [conversationId, reloadNonce]);

  return {
    conversation,
    routingPersona,
    connection,
    permissions,
    permissionsExplanation,
    isLoading,
    error,
    reload,
  };
}