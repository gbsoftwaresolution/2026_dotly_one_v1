"use client";

import { use, useEffect, useState } from "react";

import { ProtectedConversationScreen } from "@/components/connections/protected/protected-conversation-screen";
import { getConversationContext } from "@/lib/api/connections";

interface ConversationDetailsPageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationDetailsPage({
  params,
}: ConversationDetailsPageProps) {
  const { conversationId } = use(params);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const context = await getConversationContext(conversationId);

        if (cancelled) {
          return;
        }

        setConnectionId(context.connectionId);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to load conversation.",
        );
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
    return <div className="p-8">Loading protected environment...</div>;
  }

  if (error || !connectionId) {
    return <div className="p-8 text-rose-600">{error || "Not found"}</div>;
  }

  return <ProtectedConversationScreen connectionId={connectionId} />;
}
