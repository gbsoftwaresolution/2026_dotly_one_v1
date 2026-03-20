import { NotificationsScreen } from "@/components/notifications/notifications-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function NotificationsPage() {
  await requireServerSession(routes.app.notifications);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Stay up to date with requests, connections, and events."
      />
      <NotificationsScreen />
    </section>
  );
}
