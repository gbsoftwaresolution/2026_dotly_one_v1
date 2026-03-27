import { TeamAccessManager } from "@/components/settings/team-access-manager";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function InboxAssignmentsPage() {
  await requireServerSession(routes.app.inboxAssignments);

  return <TeamAccessManager />;
}