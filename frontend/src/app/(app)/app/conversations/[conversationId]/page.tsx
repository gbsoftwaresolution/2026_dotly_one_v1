import { ConversationDetailRoute } from "@/components/connections/conversation-detail-route";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

interface ConversationDetailsPageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationDetailsPage({
  params,
}: ConversationDetailsPageProps) {
  const { conversationId } = await params;

  await requireServerSession(routes.app.conversationDetail(conversationId));

  return <ConversationDetailRoute conversationId={conversationId} />;
}