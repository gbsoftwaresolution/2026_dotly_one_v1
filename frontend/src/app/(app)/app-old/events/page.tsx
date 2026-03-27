import { EventsScreen } from "@/components/events/events-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";

export default async function EventsPage() {
  const { user } = await requireServerSession("/app-old/events");

  return (
    <section className="flex flex-col mx-auto w-full max-w-2xl gap-6 animate-fade-up [animation-duration:700ms] pb-safe">
      <PageHeader
        title="Events"
        description="Events you have joined. Discover people while you are there."
      />
      <div className="flex flex-col gap-4">
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
