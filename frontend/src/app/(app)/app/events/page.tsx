import { EventsScreen } from "@/components/events/events-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function EventsPage() {
  const { user } = await requireServerSession(routes.app.events);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Events"
        description="Events you have joined. Discover people while you are there."
      />
      <EventsScreen user={user} />
    </section>
  );
}
