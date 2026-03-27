"use client";

import { use } from "react";

import { ConversationDetailRoute } from "@/components/connections/conversation-detail-route";

interface ConversationDetailsPageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationDetailsPage({
  params,
}: ConversationDetailsPageProps) {
  const { conversationId } = use(params);

  return <ConversationDetailRoute conversationId={conversationId} variant="app" />;
}