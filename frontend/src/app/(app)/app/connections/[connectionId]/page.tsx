import { ConnectionDetailsPageRoute } from "@/components/connections/connection-details-page-route";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function ConnectionDetailsPage({
  params,
}: {
  params: Promise<{ connectionId: string }>;
}) {
  const { connectionId } = await params;

  await requireServerSession(routes.app.connectionDetail(connectionId));

  return <ConnectionDetailsPageRoute connectionId={connectionId} />;
}