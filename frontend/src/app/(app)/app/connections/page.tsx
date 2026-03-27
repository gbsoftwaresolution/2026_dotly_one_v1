import { ConnectionsPageRoute } from "@/components/connections/connections-page-route";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function ConnectionsPage() {
  await requireServerSession(routes.app.connections);

  return <ConnectionsPageRoute />;
}