import Link from "next/link";

import { EventDetailScreen } from "@/components/events/event-detail-screen";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user } = await requireServerSession(routes.app.eventDetail(eventId));

  return (
    <section className="space-y-4">
      <PageHeader
        title="Event"
        action={
          <Link
            href={routes.app.events}
            className="text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            &larr; Back to Events
          </Link>
        }
      />
      <EventDetailScreen
        eventId={eventId}
        isVerified={user.isVerified}
        currentUserEmail={user.email}
      />
    </section>
  );
}
