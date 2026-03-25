import { EventsScreen } from "@/components/events/events-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function EventsPage() {
  const { user } = await requireServerSession(routes.app.events);

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Events"
        description="Events you have joined. Discover people while you are there."
      />
      <div className="premium-card rounded-[2rem] p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 space-y-1 sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Event network
          </p>
          <p className="text-sm leading-6 text-muted">
            Join a room, pick the right persona, and keep live discovery ready
            while you are there.
          </p>
        </div>
        <EventsScreen user={user} />
      </div>
    </section>
  );
}
